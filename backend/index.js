require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Document = require('./models/Document');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const callPythonService = async (filePath, mimetype) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: mimetype
    });

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const response = await axios.post(`${pythonServiceUrl}/summarize`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return response.data.summary;
  } catch (error) {
    console.error('Error calling Python service:', error.message);
    throw new Error('Failed to process document with NLP service');
  }
};

const processDocument = async (documentId) => {
  let document;
  try {
    document = await Document.findById(documentId);
    if (!document) {
      console.error(`Document ${documentId} not found`);
      return;
    }

    document.status = 'processing';
    await document.save();

    const summary = await callPythonService(document.path, document.mimetype);

    // Ensure summary is properly structured
    if (typeof summary === 'string') {
      document.summary = {
        key_points: [summary],
        tables: [],
        highlights: []
      };
    } else {
      document.summary = summary;
    }

    document.status = 'completed';
    document.processedAt = new Date();
    await document.save();

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error.message);
    if (document) {
      document.status = 'failed';
      document.error = error.message;
      await document.save();
    }
  }
};

app.get('/', (req, res) => {
  res.send('Legal Document Summarizer API');
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const document = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploaderIp: req.ip
    });

    await document.save();

    processDocument(document._id);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully. Processing started.',
      documentId: document._id,
      status: document.status
    });
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during upload'
    });
  }
});

app.get('/api/document/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      document: {
        id: document._id,
        originalName: document.originalName,
        status: document.status,
        summary: document.summary,
        uploadedAt: document.uploadedAt,
        processedAt: document.processedAt,
        error: document.error
      }
    });
  } catch (error) {
    console.error('Document fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Something broke!'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Python service URL: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await mongoose.disconnect();
  process.exit(0);
});
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
const translate = require('@vitalets/google-translate-api');
const cookieParser = require('cookie-parser');
const { router: authRouter, authenticateToken } = require('./routes/auth');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS before any other middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true
}));

// Other middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Mount auth routes first
app.use('/api/auth', authRouter);

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/legaldoc', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

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

app.post('/api/upload', authenticateToken, upload.single('document'), async (req, res) => {
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
      uploaderIp: req.ip,
      user: req.user._id
    });

    document._fileName = req.file.originalname;
    await document.save();

    // Wait for document processing to complete
    await processDocument(document._id);

    // Fetch the updated document to get the latest status
    const updatedDocument = await Document.findById(document._id);

    res.status(201).json({
      success: true,
      message: 'File uploaded and processed successfully.',
      documentId: document._id,
      status: updatedDocument.status,
      document: {
        id: updatedDocument._id,
        originalName: updatedDocument.originalName,
        status: updatedDocument.status,
        summary: updatedDocument.summary,
        uploadedAt: updatedDocument.uploadedAt,
        processedAt: updatedDocument.processedAt,
        error: updatedDocument.error
      }
    });
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during upload'
    });
  }
});

app.get('/api/document/:id', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user._id
    });
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

app.get('/api/summaries', authenticateToken, async (req, res) => {
  try {
    const documents = await Document.find({
      user: req.user._id,
      status: 'completed'
    })
      .select('originalName summary uploadedAt processedAt')
      .sort('-uploadedAt')
      .limit(20);

    const summaries = documents.map(doc => ({
      _id: doc._id,
      title: doc.originalName,
      summary: doc.summary,
      createdAt: doc.processedAt || doc.uploadedAt
    }));

    res.json({ summaries });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summaries'
    });
  }
});

app.get('/api/document/:id/status', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user._id
    }).select('status error');

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      status: document.status,
      error: document.error
    });
  } catch (error) {
    console.error('Status check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

app.post('/api/translate', authenticateToken, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'No text provided for translation'
      });
    }

    const target = targetLanguage === 'hindi' ? 'hi' : 'en';

    let translatedText;
    if (typeof text === 'string') {
      const { text: translated } = await translate(text, { to: target });
      translatedText = translated;
    } else {
      // Handle structured data translation
      const translateObject = async (obj) => {
        const translated = {};
        for (const [key, value] of Object.entries(obj)) {
          if (Array.isArray(value)) {
            translated[key] = await Promise.all(value.map(async item => {
              if (typeof item === 'string') {
                const { text: translatedItem } = await translate(item, { to: target });
                return translatedItem;
              }
              return translateObject(item);
            }));
          } else if (typeof value === 'object' && value !== null) {
            translated[key] = await translateObject(value);
          } else if (typeof value === 'string') {
            const { text: translatedValue } = await translate(value, { to: target });
            translated[key] = translatedValue;
          } else {
            translated[key] = value;
          }
        }
        return translated;
      };

      translatedText = await translateObject(text);
    }

    res.json({
      success: true,
      translatedText
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Translation failed'
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Python service URL: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await mongoose.disconnect();
  process.exit(0);
});
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('./auth');
const Document = require('../models/Document');
const { processDocument } = require('../services/documentService');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Get all documents for the user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const documents = await Document.find({ user: req.user._id })
            .sort('-uploadedAt')
            .select('-path');
        res.json({ success: true, documents });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
});

// Get recent documents
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        const documents = await Document.find({ user: req.user._id })
            .sort('-uploadedAt')
            .limit(5)
            .select('-path');
        res.json({ success: true, documents });
    } catch (error) {
        console.error('Error fetching recent documents:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch recent documents' });
    }
});

// Get documents by type
router.get('/type/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const documents = await Document.find({
            user: req.user._id,
            documentType: type
        }).sort('-uploadedAt');
        res.json({ success: true, documents });
    } catch (error) {
        console.error('Error fetching documents by type:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
});

// Upload new document
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const document = new Document({
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype,
            user: req.user._id,
            documentType: req.body.documentType || 'other',
            status: 'uploaded'
        });

        await document.save();

        // Start processing the document
        processDocument(document._id).catch(err => {
            console.error('Error processing document:', err);
        });

        res.status(201).json({
            success: true,
            documentId: document._id,
            message: 'Document uploaded successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload document' });
    }
});

// Get document status
router.get('/:id/status', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            user: req.user._id
        }).select('status error');

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({
            success: true,
            status: document.status,
            error: document.error
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ success: false, error: 'Failed to check document status' });
    }
});

// Get document details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            user: req.user._id
        }).select('-path');

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, document });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch document' });
    }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
});

module.exports = router; 
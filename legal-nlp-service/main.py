from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from tempfile import NamedTemporaryFile
from pdfminer.high_level import extract_text
from docx import Document as DocxDocument
import re
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from transformers import pipeline
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

def extract_text_from_image(file_path: str) -> str:
    """Extract text from image using OCR"""
    try:
        if file_path.lower().endswith('.pdf'):
            images = convert_from_path(file_path)
            text = ""
            for img in images:
                text += pytesseract.image_to_string(img)
            return text
        else:
            img = Image.open(file_path)
            return pytesseract.image_to_string(img)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OCR failed: {str(e)}")

def extract_text_from_file(file_path: str, file_type: str) -> str:
    """Extract text from different file types"""
    try:
        if file_type == "application/pdf":
            try:
                return extract_text(file_path)
            except:
                return extract_text_from_image(file_path)
        
        elif file_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                          "application/msword"]:
            doc = DocxDocument(file_path)
            return "\n".join([para.text for para in doc.paragraphs if para.text])
        
        elif file_type == "text/plain":
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif file_type.startswith('image/'):
            return extract_text_from_image(file_path)
            
        else:
            raise ValueError("Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")

def clean_text(text: str) -> str:
    """Clean legal text before summarization"""
    text = re.sub(r'\s+', ' ', text).strip()
    boilerplate = [
        "IN WITNESS WHEREOF", "IN CONSIDERATION OF", 
        "hereinafter referred to as", "This Agreement is made",
    ]
    for phrase in boilerplate:
        text = text.replace(phrase, '')
    return text

@app.post("/summarize")
async def summarize_document(file: UploadFile = File(...)):
    temp_file_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        text = extract_text_from_file(temp_file_path, file.content_type)
        
        summary = summarize_legal_text(text)
        
        return {
            "success": True,
            "summary": summary,
            "error": None
        }
    
    except HTTPException as he:
        return {
            "success": False,
            "summary": None,
            "error": he.detail
        }
    except Exception as e:
        return {
            "success": False,
            "summary": None,
            "error": str(e)
        }
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

def summarize_legal_text(text: str, max_length: int = 512) -> str:
    """Generate structured summary using pre-trained model"""
    try:
        cleaned_text = clean_text(text)
        chunk_size = 1024
        chunks = [cleaned_text[i:i+chunk_size] for i in range(0, len(cleaned_text), chunk_size)]
        
        # Generate initial summary
        summaries = []
        for chunk in chunks:
            summary = summarizer(chunk, max_length=max_length, min_length=30, do_sample=False)
            summaries.append(summary[0]['summary_text'])
        
        full_summary = " ".join(summaries)
        
        # Structure the summary into points and tables
        structured_summary = {
            "key_points": [],
            "tables": [],
            "highlights": []
        }
        
        # Extract key points (sentences that contain important legal terms)
        legal_terms = ["shall", "must", "obligation", "right", "duty", "liability", "warranty", "indemnity"]
        sentences = re.split(r'(?<=[.!?])\s+', full_summary)
        for sentence in sentences:
            if any(term in sentence.lower() for term in legal_terms):
                structured_summary["key_points"].append(sentence)
        
        # Create tables for structured information
        # Example: Extract parties, dates, amounts
        parties = re.findall(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:shall|must|agrees)', full_summary)
        dates = re.findall(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', full_summary)
        amounts = re.findall(r'\$\d+(?:,\d{3})*(?:\.\d{2})?', full_summary)
        
        if parties:
            structured_summary["tables"].append({
                "title": "Parties",
                "data": [{"name": party} for party in parties]
            })
        
        if dates:
            structured_summary["tables"].append({
                "title": "Important Dates",
                "data": [{"date": date} for date in dates]
            })
        
        if amounts:
            structured_summary["tables"].append({
                "title": "Financial Amounts",
                "data": [{"amount": amount} for amount in amounts]
            })
        
        # Extract highlights (important clauses or conditions)
        highlight_patterns = [
            r'(?:notwithstanding|provided that|subject to).*?\.',
            r'(?:in the event|if).*?\.',
            r'(?:shall not|must not).*?\.'
        ]
        
        for pattern in highlight_patterns:
            matches = re.findall(pattern, full_summary, re.IGNORECASE)
            structured_summary["highlights"].extend(matches)
        
        return structured_summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
import os
from dotenv import load_dotenv

load_dotenv()  # reads from backend/.env file

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Groq config ────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
MODEL        = "llama-3.3-70b-versatile"

# ── Pydantic models ────────────────────────────────────────────────────────────

class ResumeRequest(BaseModel):
    name: str = ""
    education: str = ""
    skills: str = ""
    experience: str = ""
    projects: str = ""
    target_job: str = ""
    job_description: str = ""

class OptimizeRequest(BaseModel):
    resume_text: str = ""
    job_description: str = ""

class RoastRequest(BaseModel):
    resume_text: str = ""

# ── Groq helper ────────────────────────────────────────────────────────────────

def call_groq(prompt: str) -> str:
    try:
        prompt = prompt[:6000]

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }
        body = {
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "temperature": 0.7,
        }

        res = requests.post(GROQ_URL, headers=headers, json=body, timeout=60)

        if res.status_code != 200:
            print(f"Groq error {res.status_code}: {res.text}")
            error_detail = res.json().get("error", {}).get("message", res.text)
            return f"Groq API error: {error_detail}"

        return res.json()["choices"][0]["message"]["content"]

    except requests.exceptions.Timeout:
        return "Request timed out. Please try again."
    except Exception as e:
        print(f"call_groq exception: {str(e)}")
        return f"Error: {str(e)}"

# ── PDF / text extractor ───────────────────────────────────────────────────────

@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    content  = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".txt") or filename.endswith(".md"):
        try:
            return {"text": content.decode("utf-8"), "method": "text"}
        except Exception as e:
            return {"text": "", "error": str(e)}

    if filename.endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            if text.strip():
                return {"text": text.strip()[:3000], "method": "pdfplumber"}
        except Exception as e:
            print(f"pdfplumber error: {e}")

        try:
            import pytesseract
            from pdf2image import convert_from_bytes
            pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            images   = convert_from_bytes(content, dpi=150)
            ocr_text = "\n".join(pytesseract.image_to_string(img) for img in images)
            if ocr_text.strip():
                return {"text": ocr_text.strip()[:3000], "method": "ocr"}
        except Exception as e:
            print(f"OCR error: {e}")

        return {
            "text": "",
            "error": "scanned_pdf",
            "message": "Could not extract text. Please paste your resume manually."
        }

    return {"text": "", "error": "Unsupported file type. Use .txt, .md, or .pdf"}

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/generate-resume")
def generate_resume(data: ResumeRequest):
    prompt = f"""You are an expert resume writer. Create a professional ATS-optimized resume in Markdown.

Candidate:
- Name: {data.name}
- Education: {data.education}
- Skills: {data.skills}
- Experience: {data.experience}
- Projects: {data.projects}
- Target Role: {data.target_job}

Structure:
# {data.name or "Full Name"}
## Summary
## Experience
## Projects
## Skills
## Education

Use strong action verbs. Quantify results. Keep it concise and ATS-friendly."""
    return {"resume": call_groq(prompt)}


@app.post("/match-job")
def match_job(data: ResumeRequest):
    jd = (data.job_description or data.target_job)[:800]
    prompt = f"""Compare this candidate to the job description.

Candidate:
- Name: {data.name}
- Skills: {data.skills}
- Experience: {data.experience}
- Projects: {data.projects}

Job Description: {jd}

Respond in Markdown:
## Match Score: X/100
## Matching Skills
## Missing Skills
## Top 3 Suggestions
## Tailored Summary"""
    return {"output": call_groq(prompt)}


@app.post("/linkedin-post")
def linkedin_post(data: ResumeRequest):
    prompt = f"""Write 2 professional LinkedIn posts. No hashtags. No emojis.

Candidate: {data.name}, Role: {data.target_job}
Skills: {data.skills}
Experience: {data.experience}

## Post 1 — Career Story
(Storytelling, ~150 words, ends with a question)

## Post 2 — Insight Post
(Professional insight, bullet points)"""
    return {"post": call_groq(prompt)}


@app.post("/elevator-pitch")
def elevator_pitch(data: ResumeRequest):
    prompt = f"""Write a 30-second elevator pitch.

Name: {data.name}, Role: {data.target_job}
Skills: {data.skills}
Experience: {data.experience}

## Elevator Pitch
(60-80 words, first-person, confident)

## Alternative Version

## 3 Delivery Tips"""
    return {"pitch": call_groq(prompt)}


@app.post("/github-readme")
def github_readme(data: ResumeRequest):
    prompt = f"""Write a GitHub profile README for this developer.

Name: {data.name}, Role: {data.target_job}
Skills: {data.skills}
Projects: {data.projects}

# Hi, I'm {data.name or "Name"}
## About Me
## Tech Stack
## Featured Projects
## Contact

Keep it professional and concise."""
    return {"readme": call_groq(prompt)}


@app.post("/improve-resume")
def improve_resume(data: OptimizeRequest):
    resume_snippet = data.resume_text[:1000]
    job_snippet    = data.job_description[:300]
    prompt = f"""Rewrite this resume to be ATS-optimized and impactful.

Resume:
{resume_snippet}

Target Job: {job_snippet}

Return the improved resume in Markdown.
Use strong action verbs. Quantify achievements. Remove filler phrases."""
    return {"improvement": call_groq(prompt)}


@app.post("/roast-resume")
def roast_resume(data: RoastRequest):
    resume_snippet = data.resume_text[:1000]
    prompt = f"""Roast this resume honestly but constructively.

Resume:
{resume_snippet}

## The Roast
(3-4 specific, witty criticisms)

## Biggest Weakness
(The single most damaging issue)

## How to Fix Each Issue
(Concrete, actionable suggestions)"""
    return {"roast": call_groq(prompt)}


@app.get("/")
def root():
    return {"status": "CareerCopilot AI running", "model": MODEL, "provider": "Groq"}
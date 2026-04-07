# AI Career Copilot

AI-powered career assistant that helps users improve resumes, match jobs, generate LinkedIn posts, and practice elevator pitches.

## Features

* Generate ATS-optimized resumes
* Match resume with job descriptions
* Improve resume using AI
* Generate LinkedIn posts
* Create elevator pitches
* Roast resume with constructive feedback

## Tech Stack

Backend:

* FastAPI
* Python
* Groq API (LLaMA 3)

Frontend:

* React
* JavaScript
* Tailwind / CSS

## Project Structure

backend/

* main.py
* requirements.txt

frontend/

* src
* public
* package.json

## Setup

### Backend

cd backend
pip install -r requirements.txt
uvicorn main:app --reload

### Frontend

cd frontend
npm install
npm start

## Environment Variables

Create a `.env` file inside backend:

GROQ_API_KEY=your_api_key_here

## Author

Lis Mary Lijo

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import xgboost as xgb
import numpy as np
import pandas as pd
import re
import os

from datetime import datetime

app = FastAPI(title="Interview Feedback ML Engine")

class TranscriptMessage(BaseModel):
    role: str
    content: str
    timestamp: float

class AnalysisRequest(BaseModel):
    transcript: List[TranscriptMessage]
    difficulty: str
    role: str

class AnalysisResponse(BaseModel):
    preparedness_score: int
    strengths: List[str]
    weaknesses: List[str]
    improvement_areas: List[str]
    technical_keyword_usage: float
    filler_word_ratio: float

# Load XGBoost model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "xgboost_model.json")
model = xgb.XGBRegressor()
if os.path.exists(MODEL_PATH):
    model.load_model(MODEL_PATH)
else:
    print(f"Warning: Model not found at {MODEL_PATH}")

ROLE_KEYWORDS = {
    "Java Developer": ["java", "spring", "hibernate", "jvm", "multithreading", "collections", "maven"],
    "Python Developer": ["python", "django", "flask", "pandas", "numpy", "asyncio", "pip"],
    "Frontend Engineer": ["react", "vue", "typescript", "css", "html", "javascript", "webpack", "nextjs"],
    "Backend Developer": ["node", "express", "sql", "nosql", "redis", "docker", "kubernetes", "api", "rest"],
    "Data Scientist": ["scikit-learn", "tensorflow", "pytorch", "regression", "clustering", "statistics"]
}

FILLER_WORDS = ["um", "ah", "uh", "like", "actually", "basically", "literally", "you know"]

def extract_features(transcript: List[TranscriptMessage], role: str):
    user_responses = [m for m in transcript if m.role == "user"]
    if not user_responses:
        return {f: 0 for f in ["filler_ratio", "long_pause_count", "avg_sentence_length", "ans_length_variance", "keyword_density"]}

    texts = [m.content for m in user_responses]
    full_text = " ".join(texts).lower()
    words = full_text.split()
    total_words = len(words)

    # 1. Filler word ratio
    filler_count = sum(1 for w in words if w in FILLER_WORDS)
    filler_ratio = filler_count / total_words if total_words > 0 else 0

    # 2. Long pause count (>1.5s)
    # Calculated as the time between the end of an assistant message and the start of a user message
    # OR between consecutive user messages if they represent a single turn split by Vapi
    long_pauses = 0
    for i in range(1, len(transcript)):
        prev = transcript[i-1]
        curr = transcript[i]
        # Assume timestamp is in milliseconds
        gap = (curr.timestamp - prev.timestamp) / 1000.0 if hasattr(curr, 'timestamp') and hasattr(prev, 'timestamp') else 0
        if gap > 1.5:
            long_pauses += 1

    # 3. Average sentence length (approximated by words per response)
    sentence_lengths = [len(t.split()) for t in texts]
    avg_sentence_length = np.mean(sentence_lengths) if sentence_lengths else 0

    # 4. Answer length variance
    ans_length_variance = np.var(sentence_lengths) if sentence_lengths else 0

    # 5. Technical keyword density
    keywords = ROLE_KEYWORDS.get(role, ["software", "code", "development", "testing"])
    keyword_count = sum(1 for w in words if any(kw in w for kw in keywords))
    keyword_density = keyword_count / total_words if total_words > 0 else 0

    return {
        "filler_ratio": filler_ratio,
        "long_pause_count": float(long_pauses),
        "avg_sentence_length": avg_sentence_length,
        "ans_length_variance": ans_length_variance,
        "keyword_density": keyword_density
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_interview(request: AnalysisRequest):
    features_dict = extract_features(request.transcript, request.role)
    
    # Prepare features for XGBoost (order matters!)
    feature_names = ["filler_ratio", "long_pause_count", "avg_sentence_length", "ans_length_variance", "keyword_density"]
    features_array = np.array([[features_dict[name] for name in feature_names]])
    
    # Prediction
    try:
        score = model.predict(features_array)[0]
    except Exception as e:
        print(f"Prediction error: {e}")
        score = 70 # Fallback
    
    score = min(max(int(score), 0), 100)
    
    # Generate static-ish feedback based on features for Gemini to supplement
    strengths = []
    if features_dict["keyword_density"] > 0.05:
        strengths.append("High density of relevant technical keywords")
    if features_dict["filler_ratio"] < 0.02:
        strengths.append("Clear and concise communication with minimal fillers")
        
    weaknesses = []
    if features_dict["long_pause_count"] > 3:
        weaknesses.append("Frequent long pauses during responses")
    if features_dict["ans_length_variance"] > 50:
        weaknesses.append("Inconsistent answer lengths")
        
    improvement_areas = [
        "Work on reducing filler words to sound more professional",
        "Try to maintain a consistent pace and avoid long silences",
        "Incorporate more specific technical terminology in your answers"
    ]
    
    return AnalysisResponse(
        preparedness_score=score,
        strengths=strengths or ["General competence shown"],
        weaknesses=weaknesses or ["No major red flags identified"],
        improvement_areas=improvement_areas,
        technical_keyword_usage=features_dict["keyword_density"],
        filler_word_ratio=features_dict["filler_ratio"]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

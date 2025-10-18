from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import ollama
import os

app = FastAPI()

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific domains for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionData(BaseModel):
    nodes: list
    connections: list

GENERATED_FILE = "generated_arduino.ino"

@app.post("/generate")
async def generate_code(data: ConnectionData):
    # Convert Pydantic model to JSON string
    connections = json.loads(data.json())

    prompt = f"""
    You are an expert Arduino programmer. 
    Generate a complete and executable Arduino sketch based on the following JSON configuration:

    {json.dumps(connections, indent=2)}

    Instructions:
    1. Include all necessary libraries...
    2. Assign unique pins...
    3. Initialize sensors and components...
    4. Implement logic according to JSON conditions.
    5. Return ONLY the complete Arduino code without explanations.
    """

    client = ollama.Client()
    response = client.chat(
        model="gemma3:4b",
        messages=[{"role": "user", "content": prompt}]
    )

    arduino_code = str(response)

    # Save the Arduino code to a file
    with open(GENERATED_FILE, "w") as f:
        f.write(arduino_code)

    # Return success message and file URL (optional)
    return {"message": "Arduino code generated successfully", "file": f"/download"}

# New endpoint to download the generated file
@app.get("/download")
async def download_file():
    if os.path.exists(GENERATED_FILE):
        return FileResponse(GENERATED_FILE, filename=GENERATED_FILE, media_type="text/plain")
    return {"error": "File not found"}

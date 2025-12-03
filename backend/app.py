# AOUBot Backend (Flask)
# Supports: multi-session handling, password encryption, and chat saving/retrieval

from flask import Flask, request, jsonify       # Flask for creating API routes and handling HTTP requests
from flask_cors import CORS                     # Enables cross-origin access from the React frontend
import os, sqlite3, hashlib                     # OS operations, SQLite for the database, and SHA256 for hashing
import openai                                  # OpenAI library to connect with GPT model
from dotenv import load_dotenv                  # Loads environment variables from .env file
from pathlib import Path                        # Used to accurately locate files such as .env
from uuid import uuid4                          # Generates unique IDs for temporary or new sessions

# Import database helper functions
from .database import (
    init_db, get_user_id, save_message,
    get_chat_history, get_sessions,
    upsert_session_title, delete_session
)

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    # dont raise error, just print warning
    print("WARNING: OPENAI_API_KEY is missing. The chatbot endpoint will return an error until it is set.")
else:
    openai.api_key = api_key

# Create the Flask application instance
app = Flask(__name__)

# Initialize the SQLite database and its tables
init_db()

# Allow frontend (React) to communicate with Flask backend
CORS(app)


# Reads and returns the content of the knowledge file used for chatbot responses
def load_knowledge():
    try:
        with open("../data/knowledge.txt", "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return "Knowledge file is not available right now."


# Encrypts a plain text password using SHA-256 hashing
def hash_password(password: str):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


# Health check endpoint to verify that the server is running
@app.route("/health")
def health():
    return "ok", 200


# Main chat endpoint: handles messages, communicates with OpenAI, and saves history
@app.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    question = (data.get("message") or "").strip()
    history = data.get("history", [])
    user_email = (data.get("email") or "").strip()
    session_id = (data.get("session_id") or "").strip()

    if not question:
        return jsonify({"answer": "Please enter your question."})

    # Generate a new session ID if not provided
    if not session_id:
        session_id = str(uuid4())

    # Prepare context for OpenAI API using system prompt and previous chat history
    knowledge = load_knowledge()
    messages = [
        {
            "role": "system",
            "content": (
                "You are an intelligent academic assistant for the Arab Open University. "
                "Answer only based on the following text. "
                "If no relevant information is found, reply with: "
                "'Sorry, there is no available information about this question.'\n\n"
                + knowledge
            ),
        }
    ]

    # Add previous conversation history
    for msg in history:
        messages.append({
            "role": "user" if msg["role"] == "user" else "assistant",
            "content": msg["text"]
        })

    # Add the current user question
    messages.append({"role": "user", "content": question})

    try:
        # Send request to OpenAI for response generation
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.4
        )
        answer = response.choices[0].message.content.strip()

        # Save user and bot messages if user is logged in
        if user_email:
            user_id = get_user_id(user_email)
            print("Saving conversation:", user_email, "user_id:", user_id, "session_id:", session_id)
            if user_id:
                save_message(user_id, session_id, "user", question)
                save_message(user_id, session_id, "assistant", answer)

        # Return chatbot reply and session ID
        return jsonify({
            "answer": answer,
            "session_id": session_id
        })

    except Exception as e:
        return jsonify({
            "answer": f"Error during processing: {str(e)}",
            "session_id": session_id
        })


# User registration endpoint: creates a new user with encrypted password
@app.post("/register")
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not email or not password:
        return jsonify({"success": False, "message": "All fields are required."})

    hashed_password = hash_password(password)

    try:
        conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), "users.db"))
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (username, email, hashed_password)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Registration successful."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Username or email already exists."})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error occurred: {str(e)}"})


# Login endpoint: validates user credentials using hashed password
@app.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Please enter both email and password."})

    hashed_password = hash_password(password)

    try:
        conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), "users.db"))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM users WHERE email = ? AND password = ?",
            (email, hashed_password)
        )
        user = cursor.fetchone()
        conn.close()

        if user:
            return jsonify({"success": True, "message": "Login successful."})
        else:
            return jsonify({"success": False, "message": "UserName/Password incorrect."})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error occurred: {str(e)}"})


# Rename or update session title
@app.post("/session/title")
def rename_session():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    session_id = (data.get("session_id") or "").strip()
    title = (data.get("title") or "").strip()

    user_id = get_user_id(email)
    if not user_id or not session_id:
        return jsonify({"success": False, "message": "Missing email or session ID."})

    ok = upsert_session_title(user_id, session_id, title)
    return jsonify({"success": ok})


# Delete an existing session (and its messages)
@app.delete("/session")
def remove_session():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    session_id = (data.get("session_id") or "").strip()

    user_id = get_user_id(email)
    if not user_id or not session_id:
        return jsonify({"success": False, "message": "Missing email or session ID."})

    deleted = delete_session(user_id, session_id)
    return jsonify({"success": True, "deleted_messages": deleted})


# Retrieve chat history for a specific session
@app.get("/history")
def get_history():
    email = (request.args.get("email") or "").strip()
    session_id = (request.args.get("session_id") or "").strip()
    user_id = get_user_id(email)

    if not user_id or not session_id:
        return jsonify([])

    history = get_chat_history(user_id, session_id)
    return jsonify(history)


# Retrieve all user sessions with their details
@app.get("/sessions")
def sessions():
    email = (request.args.get("email") or "").strip()
    user_id = get_user_id(email)
    if not user_id:
        return jsonify([])

    data = get_sessions(user_id)
    return jsonify(data)


@app.get("/")
def index():
    return "AOU Support Chatbot backend is running.", 200




# Run the Flask server (for local development)
if __name__ == "__main__":
    # Set debug=False for production
    app.run(host="0.0.0.0", port=8000, debug=True)
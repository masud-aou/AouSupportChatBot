# Database initialization and helper functions for AOUBot

import sqlite3   # SQLite for database operations
import os        # Used for defining correct file paths

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "users.db")



# Initialize the database and create all required tables if they don’t exist
def init_db():
    """Creates the database and its tables on the first run if not already created."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email    TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')

    # Chat messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER,
            session_id TEXT,
            role       TEXT,
            message    TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Chat sessions table (one record per user/session combination)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            session_id TEXT    NOT NULL,
            title      TEXT    DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, session_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()


# Retrieve a user ID by email address
def get_user_id(email: str):
    """Returns the user ID linked to a given email. Returns None if not found."""
    if not email:
        return None
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None


# Save a message (user or assistant) to a specific chat session
def save_message(user_id: int, session_id: str, role: str, message: str):
    """Stores a single chat line for a given session and ensures the session exists."""
    if not user_id or not session_id or not message:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Insert message into chats table
    cursor.execute(
        "INSERT INTO chats (user_id, session_id, role, message) VALUES (?, ?, ?, ?)",
        (user_id, session_id, role, message)
    )

    # Ensure session record exists in chat_sessions
    cursor.execute(
        "INSERT OR IGNORE INTO chat_sessions (user_id, session_id) VALUES (?, ?)",
        (user_id, session_id)
    )

    conn.commit()
    conn.close()


# Retrieve chat history for a given session
def get_chat_history(user_id: int, session_id: str):
    """Returns all chat messages in a session in chronological order."""
    if not user_id or not session_id:
        return []
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, message FROM chats WHERE user_id = ? AND session_id = ? ORDER BY id",
        (user_id, session_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r[0], "text": r[1]} for r in rows]


# Retrieve all user sessions with basic info (title, message count, last activity)
def get_sessions(user_id: int):
    """Returns all sessions for a user including message count and last activity."""
    if not user_id:
        return []
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            cs.session_id,
            cs.title,
            COUNT(c.id) AS messages_count,
            COALESCE(MAX(c.created_at), cs.created_at) AS last_activity
        FROM chat_sessions cs
        LEFT JOIN chats c
          ON c.user_id = cs.user_id AND c.session_id = cs.session_id
        WHERE cs.user_id = ?
        GROUP BY cs.session_id, cs.title, cs.created_at
        ORDER BY last_activity DESC
        """,
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "session_id": r[0],
            "title": r[1],
            "messages_count": r[2],
            "last_activity": r[3],
        }
        for r in rows
    ]


# Update or insert a title for a given session
def upsert_session_title(user_id: int, session_id: str, title: str):
    """Creates or updates a chat session title for a specific user."""
    if not user_id or not session_id:
        return False
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Ensure the session record exists
    cursor.execute(
        "INSERT OR IGNORE INTO chat_sessions (user_id, session_id, title) VALUES (?, ?, ?)",
        (user_id, session_id, title or None)
    )

    # Update the title if already present
    cursor.execute(
        "UPDATE chat_sessions SET title = ? WHERE user_id = ? AND session_id = ?",
        (title or None, user_id, session_id)
    )

    conn.commit()
    conn.close()
    return True


# Delete a session and all its related messages
def delete_session(user_id: int, session_id: str):
    """Removes a full session (including its messages and metadata)."""
    if not user_id or not session_id:
        return 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Delete all messages first
    cursor.execute(
        "DELETE FROM chats WHERE user_id = ? AND session_id = ?",
        (user_id, session_id)
    )
    deleted_msgs = cursor.rowcount

    # Then delete the session record itself
    cursor.execute(
        "DELETE FROM chat_sessions WHERE user_id = ? AND session_id = ?",
        (user_id, session_id)
    )

    conn.commit()
    conn.close()
    return deleted_msgs
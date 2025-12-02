// App.jsx — AOUSupportBot UI

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "./styles.css";
import ExportMenu from "./ExportMenu";
import Login from "./Login";
import { v4 as uuidv4 } from "uuid";


// Main component
export default function App() {
  // Global UI state
  const [showLogin, setShowLogin] = useState(false);     // Login modal visibility
  const [msg, setMsg] = useState("");                    // Current input value
  const [items, setItems] = useState([]);                // Messages in the active chat
  const [loading, setLoading] = useState(false);         // Bot typing indicator
  const [showIntro, setShowIntro] = useState(true);      // Welcome card visibility
  const [history, setHistory] = useState([]);            // Chat sessions list (UI copy)
  const [activeId, setActiveId] = useState(null);        // Active session id
  const [showSplash, setShowSplash] = useState(true);    // Splash screen visibility
  const [isLoggedIn, setIsLoggedIn] = useState(false);   // Auth flag
  const [userInfo, setUserInfo] = useState(null);        // Logged-in user info (e.g., email)
  const [modalContent, setModalContent] = useState("");  // Text content for docs/faq/support modal
  const [modalTitle, setModalTitle] = useState("");      // Title for the modal
  const listRef = useRef(null);                          // Scroll container for messages

  // Mobile-only drawers
  const [showHistory, setShowHistory] = useState(false); // Mobile history drawer
  const [showMenu, setShowMenu] = useState(false);       // Mobile docs/faq/support drawer

  // Sticky session id for guests and logged-in users
  const [sessionId, setSessionId] = useState(
    localStorage.getItem("aou_session_id") || uuidv4()
  );

  // Persist session id locally whenever it changes
  useEffect(() => {
    localStorage.setItem("aou_session_id", sessionId);
  }, [sessionId]);

  // Splash screen timing
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Load local history and auth flag on first render
  useEffect(() => {
    try {
      const logged = localStorage.getItem("aou_is_logged_in") === "true";
      if (logged) {
        const saved = JSON.parse(localStorage.getItem("aou_chat_history") || "[]");
        setHistory(saved);
        if (saved.length) {
          const last = saved[saved.length - 1];
          setActiveId(last.id);
          setItems(last.items);
          setShowIntro(false);
        }
        setIsLoggedIn(true);
      } else {
        setHistory([]);
        setItems([]);
        setActiveId(null);
        setShowIntro(true);
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
    }
  }, []);

  // Always keep the list scrolled to the newest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [items, loading]);

  // Persist history to localStorage whenever it changes
useEffect(() => {
  localStorage.setItem("aou_chat_history", JSON.stringify(history));
}, [history]);


  // Ensure there is always an active session in the UI
  useEffect(() => {
    if (!activeId) {
      const id = Date.now().toString();
      const title = "New Chat - " + new Date().toLocaleTimeString();
      const chat = { id, title, ts: Date.now(), items: [] };
      setHistory((h) => [...h, chat]);
      setActiveId(id);
    }
  }, [activeId]);

  // Load text files from /public into a modal (Documentation / FAQ / Support)
  const openModalWithFile = async (fileName, title) => {
    try {
      const res = await fetch(`/${fileName}`);
      const text = await res.text();
      setModalContent(text);
      setModalTitle(title);
    } catch {
      setModalContent("⚠️ Failed to load content.");
      setModalTitle(title);
    }
  };

  const closeModal = () => {
    setModalContent("");
    setModalTitle("");
  };

  // ... next section will cover: login handling, export, newChat, renameChat, switchChat, saveActive
  // and then: send, voice input, outside-click handler, link conversion, and the JSX layout.


//--------------------------------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL;


// Handle user login from the Login component
const handleLogin = async (user) => {
  setUserInfo(user);
  setIsLoggedIn(true);
  localStorage.setItem("aou_is_logged_in", "true");

  try {
    const res = await axios.get(`${API_BASE}/sessions`, {
      params: { email: user.email },
    });

    const sessions = res.data.map((s) => ({
      id: s.session_id,
      title: s.title || "Unnamed Chat",
      ts: s.last_activity,
      items: [],
    }));

    setHistory(sessions);
  } catch (err) {
    console.error("Failed to load user sessions:", err);
  }
};

// Export active chat conversation (PDF or TXT)
const handleExport = (type) => {
  // 1) اRely on the messages displayed now first.
  const chatData =
    (items && items.length ? items : []) ||
    (history.find((x) => x.id === activeId)?.items || []);

  if (!chatData.length) {
    alert("⚠️ No messages to export.");
    return;
  }

  //Clean up any HTML and get clean text.
  const lines = chatData.map((m) => {
    const raw = String(m.text ?? "");
    const plain = raw.replace(/<[^>]+>/g, ""); //Remove tags
    return `${m.role === "user" ? "You" : "Bot"}: ${plain}`;
  });

  if (type === "pdf") {
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(12);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 10, y);
      y += 8 * wrapped.length;
      if (y > 270) { doc.addPage(); y = 10; }
    });
    doc.save(`chat_${activeId || "current"}.pdf`);
  } else {
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${activeId || "current"}.txt`;
    a.click();
  }
};


// Create a new chat manually
const newChat = () => {
  const id = Date.now().toString();
  const title = new Date().toLocaleString();
  const chat = { id, title, ts: Date.now(), items: [] };
  setHistory((h) => [...h, chat]);
  setActiveId(id);
  setItems([]);
  setShowIntro(false);
};

// Rename a chat session and sync with the backend
const renameChat = async (id, newTitle) => {
  try {
    setHistory((h) =>
      h.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );

    if (isLoggedIn && userInfo?.email) {
      await axios.post(`${API_BASE}/session/title`, {
        email: userInfo.email,
        session_id: id,
        title: newTitle,
      });
    }
  } catch (err) {
    console.error("Failed to rename session:", err);
  }
};

// Switch between existing sessions and load their messages
// Switch between existing sessions and load their messages
// Switch between existing sessions and load their messages
const switchChat = async (id) => {
  try {
    //Save the current session before switching
    setHistory((h) =>
      h.map((c) =>
        c.id === activeId ? { ...c, items } : c
      )
    );

    setActiveId(id);
    setShowIntro(false);

    // اRetrieve conversations from the server
    const res = await axios.get(`${API_BASE}/history`, {
      params: { email: userInfo?.email || "", session_id: id },
    });

    //Make sure there is reference data.
    const fetched = res.data || [];

    //Conversion format to fit React display
    const formatted = fetched.map((m) => ({
      role: m.role,
      text:
        typeof m.text === "string"
          ? m.text.replace(/^'|'$/g, "") //Removing excess quotation marks from Arabic texts
          : "",
      direction: /[\u0600-\u06FF]/.test(m.text) ? "rtl" : "ltr",
      align: /[\u0600-\u06FF]/.test(m.text) ? "right" : "left",
    }));

    //Update the status (UI)
    setItems(formatted);

    //Update session data in history
    setHistory((h) =>
      h.map((c) =>
        c.id === id ? { ...c, items: formatted } : c
      )
    );
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
};




// Save the active chat messages into the selected session
const saveActive = (newItems) => {
  setItems(newItems);
  if (!activeId) return;
  setHistory((h) =>
    h.map((c) => (c.id === activeId ? { ...c, items: newItems } : c))
  );
};
//--------------------------------------------------------------------------------------------------
// Send a message to the backend and display the AI response
const send = async (e) => {
  e.preventDefault();
  const text = msg.trim();
  if (!text) return;

  //Add the user message to the interface immediately
  const next = [...items, { role: "user", text }];
  saveActive(next);    // يحدّث items و history[activeId].items
  setMsg("");

  try {
    setLoading(true);

    //Important: Send "previous date only" without the current message.
    //Because the backend adds the current question back by itself.
    const res = await axios.post(`${API_BASE}/chat`, {
      message: text,
      history: items,  
      email: isLoggedIn && userInfo?.email ? userInfo.email : "",
      session_id: sessionId,
    });

    const ans = res?.data?.answer ?? "No response received.";

    // لو السيرفر رجّع session_id جديد، ثبّته فورًا في الحالة وقائمة الجلسات
    if (res.data?.session_id && res.data.session_id !== sessionId) {
      const newId = res.data.session_id;
      setSessionId(newId);

      // غيّر معرّف الجلسة الحالية داخل history ليطابق معرّف السيرفر
      setHistory((h) => h.map((c) => (c.id === activeId ? { ...c, id: newId } : c)));
      setActiveId(newId);
    }

    // تأثير الكتابة (stream-like)
    let displayedText = "";
    // أضف مكان لرسالة البوت الفارغة (سيتم ملؤه تدريجيًا)
    saveActive([...next, { role: "bot", text: "" }]);
    let i = 0;

    const typing = setInterval(() => {
      if (i < ans.length) {
        displayedText += ans[i++];
        setItems((prev) => {
          const updated = [...prev];
          const isArabic = /[\u0600-\u06FF]/.test(ans);
          updated[updated.length - 1] = {
            role: "bot",
            text: displayedText,
            direction: isArabic ? "rtl" : "ltr",
            align: isArabic ? "right" : "left",
          };
          return updated;
        });
      } else {
        clearInterval(typing);
        // بعد اكتمال الكتابة، خزّن الحالة النهائية في history
        setItems((prev) => {
          const finalList = [...prev];
          saveActive(finalList);    // يحدّث history[activeId].items بالنسخة النهائية
          return finalList;
        });
      }
    }, 30);

  } catch (error) {
    console.error("Server error:", error);
    // أظهر رسالة خطأ داخل المحادثة واحفظها
    const fail = [...next, { role: "bot", text: "Connection error with server." }];
    saveActive(fail);

  } finally {
    setLoading(false);
    // مزامنة احتياطية: تأكد أن history يحمل آخر items (حتى لو بدون انتظار انتهاء الكتابة)
    setHistory((h) => h.map((c) => (c.id === activeId ? { ...c, items } : c)));
  }
};


// Basic voice input using Web Speech API
const startVoiceInput = () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech input is not supported in this browser.");
    return;
  }

  const recognition = new window.webkitSpeechRecognition();
  recognition.lang = msg.match(/^[a-zA-Z]/) ? "en-US" : "ar-SA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => setMsg(e.results[0][0].transcript);
  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    alert("An error occurred during voice input.");
  };
  recognition.start();
};

// Close modals when user clicks outside (Menu / History / Login)
useEffect(() => {
  const handleClickOutside = (event) => {
    const modal = document.querySelector(".mobile-modal");
    if (modal && !modal.contains(event.target)) {
      setShowMenu(false);
      setShowHistory(false);
      setShowLogin(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, [showMenu, showHistory, showLogin]);


//-------------------------------------------------------------------------------------------------

// Converts URLs inside chatbot messages into clickable links
function convertLinks(text) {
  const urlRegex =
    /(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)(?=\s|$|[)\]}.,!?])/g;
  return text.replace(urlRegex, (url) => {
    const cleanUrl = url.replace(/[)\]}.,!?]*$/, "");
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
  });
}

// ======================
// Main Component Layout
// ======================
if (showSplash) {
  return (
    <div className="splash-screen">
      <h1 className="splash-text">Welcome to AOU Support Bot</h1>
      <p className="splash-subtext">Your Trusted Assistance</p>
    </div>
  );
}

return (
  <div className="flex flex-col md:flex-row min-h-screen w-screen bg-[#f5f6f8] font-sans overflow-hidden">
    {/* Left sidebar (desktop view) */}
    <aside className="hidden md:flex w-[215px] bg-[#1f273b] text-white flex-col gap-3 p-3">
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("docs.txt", "Documentation")}
      >
        Documentation
      </button>
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("faq.txt", "FAQ")}
      >
        FAQ
      </button>
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("support.txt", "Support Services")}
      >
        Support
      </button>
      

      <div className="h-px bg-gray-500 my-2" />
      {isLoggedIn && <ExportMenu onExport={handleExport} />}
    </aside>

    {/* Mobile top menu buttons */}
    <div className="flex md:hidden justify-around bg-[#1f273b] text-white py-2">
      <button onClick={() => setShowMenu(!showMenu)}>☰ Menu</button>
      <button onClick={() => setShowHistory(!showHistory)}>📜 History</button>
    </div>

    {/* Mobile modal for Docs/FAQ/Support */}
{/* Mobile modal for Docs/FAQ/Support */}
{showMenu && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
    <div className="mobile-modal bg-[#1f273b] text-white p-4 rounded-lg w-[300px] max-w-[90vw] flex flex-col gap-3">
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("docs.txt", "Documentation")}
      >
        Documentation
      </button>
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("faq.txt", "FAQ")}
      >
        FAQ
      </button>
      <button
        className="bg-gray-700 rounded-lg p-2 text-left"
        onClick={() => openModalWithFile("support.txt", "Support Services")}
      >
        Support
      </button>

      {/* ✅ زر التصدير يظهر فقط إذا المستخدم مسجل */}
      {isLoggedIn && (
        <button
          className="bg-green-700 rounded-lg p-2 text-left"
          onClick={() => {
            const type = window.confirm("Export as PDF? (Cancel for TXT)")
              ? "pdf"
              : "txt";
            handleExport(type);
            setShowMenu(false);
          }}
        >
          📤 Export Chat
        </button>
      )}

      <button
        onClick={() => setShowMenu(false)}
        className="mt-2 bg-gray-600 rounded-lg py-1"
      >
        Close
      </button>
    </div>
  </div>
)}


    {/* Mobile modal for chat history */}
    {showHistory && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
        <div className="mobile-modal bg-[#1f273b] text-white p-4 rounded-lg w-[300px] max-w-[90vw] flex flex-col gap-3">
          <h2 className="text-center font-bold mb-2 border-b border-white pb-1">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {history.length ? (
              history.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded border ${
                    activeId === c.id ? "border-blue-600" : "border-white"
                  } bg-white text-black`}
                >
                  <div
                    onClick={() => {
                      switchChat(c.id);
                      setShowHistory(false);
                    }}
                    className="text-center font-semibold cursor-pointer truncate"
                  >
                    {c.title}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-gray-300">
                No chats yet.
              </div>
            )}
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="mt-3 bg-gray-600 w-full py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    )}

    {/* Main chat section */}
    <main className="flex-1 flex flex-col bg-[#fff9f9]">
      {/* Header */}
      <div className="relative flex items-center gap-6 bg-[#464545] text-white px-4 py-3 border-b border-black">
        <img
          src="/logo.png"
          alt="logo"
          className="w-[80px] h-[80px] object-contain"
        />
        <h1 className="text-3xl md:text-4xl font-bold">AOUSupportBot</h1>

        {!isLoggedIn ? (
          <button
            className="absolute right-2 top-2 bg-[#1f2937] text-white px-2 py-1 rounded text-sm md:px-3 md:py-2 md:text-base"
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>
        ) : (
          <button
            className="absolute right-2 top-2 bg-[#1f2937] text-white px-2 py-1 rounded text-sm md:px-3 md:py-2 md:text-base"
            onClick={() => {
              setIsLoggedIn(false);
              setUserInfo(null);
              setItems([]);
              setActiveId(null);
              setShowIntro(true);
              setHistory([]);
              localStorage.removeItem("aou_is_logged_in");
              localStorage.removeItem("aou_chat_history");
            }}
          >
            Logout
          </button>
        )}
      </div>

      {/* Chat content */}
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col p-3">
          {showIntro ? (
            // Welcome screen
            <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-[680px] mx-auto mt-6">
              <h2 className="text-xl font-semibold mb-2">
                Welcome to AOUSupportBot!
              </h2>
              <p className="text-sm text-gray-600">
                Here are a few things you can ask:
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2">
                <li>Overview of AOU support services.</li>
                <li>Specific services (IT, exams, financial, library…)</li>
                <li>Example: “How can I reset my university email password?”</li>
              </ul>
              <button
                className="mt-2 bg-gray-800 px-4 py-2 rounded text-white"
                onClick={() => setShowIntro(false)}
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              {/* Chat message list */}
              <div
                ref={listRef}
                className="overflow-y-auto bg-[#c9e5f1] border border-[#021130] rounded-lg p-3 h-[74vh] md:h-[68vh]"
                style={{ scrollBehavior: "auto" }}
              >
{items && items.length > 0 ? (
  items.map((it, i) => {
    const safeText =
      typeof it.text === "string"
        ? it.text.replace(/^'|'$/g, "").trim()
        : String(it.text || "").trim();

    const content = convertLinks(safeText);

    return (
      <div
        key={i}
        className={`my-2 flex ${
          it.role === "user" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`max-w-[70%] rounded-2xl px-3 py-2 text-[16px] leading-6 break-words ${
            it.role === "user"
              ? "bg-[#024408] text-white"
              : "bg-black text-white"
          }`}
          style={{
            direction: it.direction || (/[\u0600-\u06FF]/.test(safeText) ? "rtl" : "ltr"),
            textAlign: it.align || (/[\u0600-\u06FF]/.test(safeText) ? "right" : "left"),
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    );
  })
) : (
  <div className="text-center text-gray-500 italic mt-4">
    No messages yet.
  </div>
)}

                {loading && (
                  <div className="text-sm text-gray-700 text-center">
                    Preparing response...
                  </div>
                )}
              </div>

              {/* Input bar */}
              <form
                onSubmit={send}
                className="flex gap-2 mt-3 md:mt-0 md:static fixed bottom-0 left-0 w-full p-3 bg-[#fff9f9] border-t border-gray-300 z-[50]"
              >
                <input
                  className="flex-1 px-3 py-2 rounded-lg border border-white bg-black text-white text-lg"
                  placeholder="Type your question or use the mic..."
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                />
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className="px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-lg"
                >
                  🎙️
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 rounded-lg bg-black text-white"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>

        {/* Right sidebar (desktop history) */}
        <aside className="hidden md:flex w-[260px] h-screen bg-[#1f273b] text-white flex-col gap-3 p-3 border-l border-black overflow-y-auto">
          <button
            className="w-full md:w-[235px] md:h-[50px] bg-gray-700 rounded-lg p-2 md:p-2 text-sm md:text-lg"
            onClick={newChat}
          >
            New Chat
          </button>

          <div className="bg-white text-black rounded-lg p-3">
            <p className="text-center font-bold border-b pb-1 mb-2">History</p>
            <div className="flex flex-col gap-2">
              {history.length ? (
                history.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2 rounded border ${
                      activeId === c.id
                        ? "border-blue-600"
                        : "border-black"
                    } bg-white`}
                  >
                    {c.editing ? (
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-sm"
                        defaultValue={c.title}
                        autoFocus
                        onBlur={(e) => renameChat(c.id, e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && renameChat(c.id, e.target.value)
                        }
                      />
                    ) : (
                      <div
                        onClick={() => switchChat(c.id)}
                        title={c.title}
                        className="text-center font-semibold text-sm truncate cursor-pointer"
                      >
                        {c.title}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        className="flex-1 bg-teal-600 text-white rounded px-2 py-1 text-sm"
                        onClick={() =>
                          setHistory((h) =>
                            h.map((x) =>
                              x.id === c.id
                                ? { ...x, editing: !x.editing }
                                : x
                            )
                          )
                        }
                      >
                        ✏️
                      </button>
                      <button
                        className="flex-1 bg-red-600 text-white rounded px-2 py-1 text-sm"
                        onClick={() => {
                          if (window.confirm("Delete this chat?")) {
                            setHistory((h) => h.filter((x) => x.id !== c.id));
                            if (activeId === c.id) {
                              setActiveId(null);
                              setItems([]);
                              setShowIntro(true);
                            }
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-gray-600">
                  No chats yet.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>

    {/* Login modal */}
    {showLogin && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
        <div className="mobile-modal bg-white w-[400px] max-w-[90vw] rounded-lg p-4">
          <Login
            onLogin={(user) => {
              setUserInfo(user);
              setIsLoggedIn(true);
              setShowLogin(false);
              localStorage.setItem("aou_is_logged_in", "true");
            }}
          />
          <button
            onClick={() => setShowLogin(false)}
            className="mt-2 bg-gray-800 px-4 py-2 rounded text-white"
          >
            Close
          </button>
        </div>
      </div>
    )}

    {/* Docs / FAQ / Support modal */}
    {modalContent && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
        <div className="bg-white w-[600px] max-w-[95vw] rounded-lg p-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-2">{modalTitle}</h3>
          <pre className="whitespace-pre-wrap text-[16px] leading-7 text-[#111]">
            {modalContent}
          </pre>
          <button
            onClick={() => {
              setModalContent("");
              setModalTitle("");
            }}
            className="mt-2 bg-gray-600 px-3 py-2 rounded text-white"
          >
            Close
          </button>
        </div>
      </div>
    )}
  </div>
);
}
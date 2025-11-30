// ExportMenu.jsx — Chat Export Dropdown Menu

import React, { useState } from "react";

function ExportMenu({ onExport }) {
  const [showMenu, setShowMenu] = useState(false); // Toggles visibility of export menu

  // Handle export click and close the dropdown
  const handleExport = (type) => {
    setShowMenu(false);
    onExport(type);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Button to toggle export dropdown */}
      <button onClick={() => setShowMenu(!showMenu)}>📤 Export</button>

      {/* Export options menu */}
      {showMenu && (
        <div
          style={{
            position: "absolute",
            background: "#080101ff",
            border: "1px solid #0c0101ff",
            marginTop: "4px",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => handleExport("pdf")}
            style={{
              padding: "6px 10px",
              cursor: "pointer",
              color: "#fff",
              background: "#242424",
            }}
          >
            Export as PDF
          </div>

          <div
            onClick={() => handleExport("txt")}
            style={{
              padding: "6px 10px",
              cursor: "pointer",
              color: "#fff",
              background: "#242424",
            }}
          >
            Export as Text
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
/// A page for looking at one screen without the product around it.
///
/// The window is a desktop app and this session is refused both screen
/// capture and accessibility, so the only way to see the interface is to
/// render it somewhere a command line can reach. It mounts the **real**
/// layout components — an imitation would only prove the imitation.
///
/// ```sh
/// bun run --cwd web dev --port 5199 &
/// tools/look.sh out.png "?light&plain"
/// ```
///
/// It has already earned itself three times: the editor was wearing Monaco's
/// stock primaries under mine, the brackets kept a rainbow the editor option
/// could not switch off, and a licence file was one line six hundred
/// characters long.
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "../src/theme.css";
import { Mono, RowButton, Text } from "../src/components";
import { Listing, ListingItem, Mount, Row } from "../src/frame";
import { Workbench } from "../src/layouts";
import { THEME, definition, paletteFor } from "../src/core/monaco-theme";

self.MonacoEnvironment = { getWorker: () => new editorWorker() };

const q = new URLSearchParams(location.search);
const dark = q.has("dark") ? true : q.has("light") ? false : matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", dark);

const LICENSE = `MIT License

Copyright (c) 2026 Henrique Artur

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
`;

const RUST = `use std::path::Path;

/// The queue for one project, from its facts.
#[derive(Debug, Clone)]
pub struct SessionState {
    pub session: SessionId,
    awaiting_human: bool,
}

impl SessionState {
    pub fn queue(states: &[Self], now: Timestamp, idle_after_ms: i64) -> Vec<QueueItem> {
        let mut out = Vec::new();
        for s in states {
            if s.awaiting_human && now.elapsed_to(s.last) > idle_after_ms {
                out.push(QueueItem::new(s.session.clone(), DecisionKind::Review, s.last));
            }
        }
        out // 42 items, "at most"
    }
}
`;

const plain = q.has("plain");

function Editor() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let editor: { dispose: () => void } | null = null;
    void import("monaco-editor/esm/vs/editor/editor.main").then((monaco) => {
      if (!host.current) return;
      monaco.editor.defineTheme(THEME, definition(paletteFor(dark)));
      editor = monaco.editor.create(host.current, {
        value: plain ? LICENSE : RUST,
        language: plain ? "plaintext" : "rust",
        readOnly: true,
        theme: THEME,
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 12, bottom: 12 },
        wordWrap: "on",
        wrappingIndent: "indent",
        bracketPairColorization: { enabled: false },
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
      });
    });
    return () => editor?.dispose();
  }, []);
  return <Mount ref={host} />;
}

const FILES = ["Cargo.toml", "LICENSE-MIT", "README.md", "arch.config.json", "rust-toolchain.toml"];

createRoot(document.getElementById("root")!).render(
  <Workbench
    bar={
      <>
        <Row gap="snug" align="baseline">
          <Text as="span" size="sm" tone="muted">
            bancada
          </Text>
          <Mono>/ {plain ? "LICENSE-MIT" : "crates/bancada-rules/src/session_state.rs"}</Mono>
        </Row>
        <Text as="span" size="sm" tone="faint">
          probe
        </Text>
      </>
    }
    index={
      <Listing>
        {FILES.map((f) => (
          <ListingItem key={f}>
            <RowButton selected={plain ? f === "LICENSE-MIT" : false} className="gap-1.5">
              {f}
            </RowButton>
          </ListingItem>
        ))}
      </Listing>
    }
    subject={<Editor />}
  />,
);

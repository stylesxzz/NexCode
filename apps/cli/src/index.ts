#!/usr/bin/env bun
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
} from "@opentui/core";
import { importKnowledgePdf, isWorkMode, listKnowledgeBooks, removeKnowledgeBook, type ChatMessage, type WorkMode } from "@nexcode/core";
import { generateResponse } from "@nexcode/providers";

const localEnv = resolve(process.cwd(), ".env");
const rootEnv = resolve(process.cwd(), "../../.env");
dotenv.config({ path: existsSync(localEnv) ? localEnv : rootEnv });

const renderer = await createCliRenderer({ exitOnCtrlC: true });

let mode: WorkMode = "development";
let draft = "";
let busy = false;
let knowledgeView = false;
let pendingApproval: { summary: string; details: string } | null = null;
let approvalResolver: ((approved: boolean) => void) | null = null;
const conversation: ChatMessage[] = [];

const shell = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  padding: 1,
  flexDirection: "column",
  gap: 1,
  backgroundColor: "#080B09",
});

const header = new TextRenderable(renderer, {
  content: " N E X C O D E   /   OPEN SOURCE CODING AGENT ",
  fg: "#39E58C",
});
const modeLine = new TextRenderable(renderer, {
  content: "MODE  [F1] development   [F2] planning   [F3] ask   [F4] knowledge",
  fg: "#B8C8BE",
});
const transcript = new TextRenderable(renderer, {
  content: "Ready. Development can inspect files; writes and commands pause for your approval. Planning is read-only; Ask has no tools.",
  fg: "#E6EEE9",
});
const inputLine = new TextRenderable(renderer, {
  content: "> ",
  fg: "#39E58C",
});
const footer = new TextRenderable(renderer, {
  content: "Enter send  •  F1/F2/F3 modes  •  F4 knowledge  •  /book add|list|remove  •  Y/N approval  •  Ctrl+C quit",
  fg: "#73847A",
});

shell.add(header);
shell.add(modeLine);
shell.add(new TextRenderable(renderer, { content: "─".repeat(56), fg: "#285B40" }));
shell.add(transcript);
shell.add(inputLine);
shell.add(footer);
renderer.root.add(shell);

function refresh() {
  modeLine.content = `MODE  [F1] development   [F2] planning   [F3] ask   [F4] knowledge${knowledgeView ? "  [OPEN]" : ""}     CURRENT: ${mode.toUpperCase()}`;
  inputLine.content = `> ${draft}${busy ? "  [working…]" : ""}`;
}

async function submit() {
  const prompt = draft.trim();
  if (!prompt || busy) return;

  draft = "";
  busy = true;
  refresh();
  transcript.content = `YOU  ·  ${prompt}\n\nNEXCODE  ·  Contacting configured provider…`;

  try {
    if (prompt.startsWith("/book")) {
      const [, action = "help", ...parts] = prompt.split(/\\s+/u);
      const argument = parts.join(" ").replace(/^["']|["']$/gu, "");
      if (action === "add" && argument) {
        transcript.content = "KNOWLEDGE LIBRARY  ·  Extracting and indexing PDF locally…";
        const book = await importKnowledgePdf(resolve(argument));
        transcript.content = `BOOK IMPORTED  ·  ${book.title}\n\nPages: ${book.pages}  ·  Indexed passages: ${book.chunks.length}\nSource: ${book.sourceName}\n\nThe agent will retrieve relevant excerpts automatically in future prompts.`;
      } else if (action === "list") {
        const books = await listKnowledgeBooks();
        transcript.content = books.length
          ? "KNOWLEDGE LIBRARY\n\n" + books.map((book) => `${book.title}  ·  ${book.pages} pages  ·  ${book.chunks.length} passages\nID: ${book.id}`).join("\n\n")
          : "KNOWLEDGE LIBRARY\n\nNo PDFs imported yet. Use /book add /path/to/book.pdf";
      } else if (action === "remove" && argument) {
        const removed = await removeKnowledgeBook(argument);
        transcript.content = removed ? "Book removed from the local knowledge library." : "Book not found. Use /book list to see available IDs and titles.";
      } else {
        transcript.content = "KNOWLEDGE LIBRARY COMMANDS\n\n/book add /path/to/book.pdf\n/book list\n/book remove <book-id-or-title>\n\nPDF text extraction requires Poppler (pdftotext) installed and available on PATH.";
      }
      return;
    }

    const answer = await generateResponse(prompt, mode, {
      workspaceRoot: process.cwd(),
      messages: conversation,
      requestApproval: (request) => new Promise<boolean>((resolveApproval) => {
        pendingApproval = request;
        approvalResolver = resolveApproval;
        transcript.content = `APPROVAL REQUIRED\n\n${request.summary}\n\n${request.details}\n\nPress Y to approve or N to deny.`;
        refresh();
      }),
    });
    conversation.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
    if (conversation.length > 20) conversation.splice(0, conversation.length - 20);
    transcript.content = conversation.slice(-10).map((message) =>
      `${message.role === "user" ? "YOU" : "NEXCODE"}  ·  ${message.content}`
    ).join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    conversation.push({ role: "user", content: prompt }, { role: "assistant", content: message });
    if (conversation.length > 20) conversation.splice(0, conversation.length - 20);
    transcript.content = conversation.slice(-10).map((item) =>
      `${item.role === "user" ? "YOU" : "NEXCODE"}  ·  ${item.content}`
    ).join("\n\n");
  } finally {
    busy = false;
    refresh();
  }
}

renderer.keyInput.on("keypress", (key) => {
  if (pendingApproval && approvalResolver) {
    const choice = key.name?.toLowerCase() ?? key.sequence?.toLowerCase();
    if (choice === "y") {
      const resolveApproval = approvalResolver;
      pendingApproval = null;
      approvalResolver = null;
      transcript.content += "\n\nAPPROVED by user.";
      resolveApproval(true);
      refresh();
    } else if (choice === "n" || key.name === "escape") {
      const resolveApproval = approvalResolver;
      pendingApproval = null;
      approvalResolver = null;
      transcript.content += "\n\nDENIED by user.";
      resolveApproval(false);
      refresh();
    }
    return;
  }
  if (busy) return;

  if (key.name === "f4") {
    knowledgeView = !knowledgeView;
    if (knowledgeView) {
      void listKnowledgeBooks().then((books) => {
        transcript.content = books.length
          ? "KNOWLEDGE LIBRARY  ·  LOCAL PDF SOURCES\\n\\n" + books.map((book) => `${book.title}  ·  ${book.pages} pages  ·  ${book.chunks.length} passages\\nID: ${book.id}`).join("\\n\\n") + "\\n\\nImport: /book add /path/to/book.pdf\\nRemove: /book remove <id-or-title>"
          : "KNOWLEDGE LIBRARY  ·  No books imported yet.\\n\\nImport a PDF with: /book add /path/to/book.pdf\\nList: /book list";
      }).catch((error) => {
        transcript.content = `Could not load knowledge library: ${error instanceof Error ? error.message : String(error)}`;
      });
    } else {
      transcript.content = "Knowledge library closed. Type a message or use /book add, /book list, /book remove.";
    }
    refresh();
    return;
  }

  if (key.name === "f1" || key.name === "f2" || key.name === "f3") {
    const selected = key.name === "f1" ? "development" : key.name === "f2" ? "planning" : "ask";
    if (isWorkMode(selected)) mode = selected;
    refresh();
    return;
  }

  if (key.name === "return") {
    void submit();
    return;
  }

  if (key.name === "backspace") {
    draft = draft.slice(0, -1);
    refresh();
    return;
  }

  if (key.name === "space") {
    draft += " ";
    refresh();
    return;
  }

  const character = key.sequence ?? "";
  if (character && !/[\u0000-\u001F\u007F]/u.test(character)) {
    draft += character;
    refresh();
  }
});

process.once("SIGTERM", () => renderer.destroy());
refresh();

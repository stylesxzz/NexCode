#!/usr/bin/env bun
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
} from "@opentui/core";
import { isWorkMode, type WorkMode } from "@nexcode/core";
import { generateResponse } from "@nexcode/providers";

const localEnv = resolve(process.cwd(), ".env");
const rootEnv = resolve(process.cwd(), "../../.env");
dotenv.config({ path: existsSync(localEnv) ? localEnv : rootEnv });

const renderer = await createCliRenderer({ exitOnCtrlC: true });

let mode: WorkMode = "development";
let draft = "";
let busy = false;

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
  content: "MODE  [F1] development   [F2] planning   [F3] ask",
  fg: "#B8C8BE",
});
const transcript = new TextRenderable(renderer, {
  content: "Ready. Configure NEXCODE_API_KEY in .env to connect your model provider.",
  fg: "#E6EEE9",
});
const inputLine = new TextRenderable(renderer, {
  content: "> ",
  fg: "#39E58C",
});
const footer = new TextRenderable(renderer, {
  content: "Enter send  •  F1/F2/F3 switch mode  •  Backspace edit  •  Ctrl+C quit",
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
  modeLine.content = `MODE  [F1] development   [F2] planning   [F3] ask     CURRENT: ${mode.toUpperCase()}`;
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
    const answer = await generateResponse(prompt, mode);
    transcript.content = `YOU  ·  ${prompt}\n\nNEXCODE  ·  ${answer}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    transcript.content = `YOU  ·  ${prompt}\n\nNEXCODE  ·  ${message}`;
  } finally {
    busy = false;
    refresh();
  }
}

renderer.keyInput.on("keypress", (key) => {
  if (busy) return;

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
  if (character.length === 1 && character >= " " && character <= "~") {
    draft += character;
    refresh();
  }
});

process.once("SIGTERM", () => renderer.destroy());
refresh();

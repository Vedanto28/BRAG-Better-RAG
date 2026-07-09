# BRAG (Better RAG) Chat Interface

## Objective

Create a modern, responsive AI chat interface for **BRAG (Better RAG)** using:

* React (JavaScript)
* Tailwind CSS
* React Functional Components
* Custom Hooks
* Bootstrap Icons

Do **not** use TypeScript.

The UI should feel similar to ChatGPT, Claude, and modern AI assistants while maintaining a unique identity centered around BRAG and Mechamaru.

---

# Application Identity

## Product Name

BRAG

**Full Form:** Better RAG

## Assistant Name

Mechamaru

## Product Description

BRAG is an intelligent AI system that goes beyond traditional Retrieval-Augmented Generation.

Unlike standard chatbots that primarily generate responses, BRAG can reason, retrieve information, execute tasks, and perform actions through agent workflows.

Mechamaru serves as the primary AI assistant within the BRAG ecosystem.

---

# Core Layout Requirements

Create a:

* Full-screen application
* Single-column chat layout
* Mobile-first responsive design
* Modern rounded UI
* Smooth scrolling experience

The interface should occupy the entire viewport.

---

# Theme Requirements

Implement automatic theme detection using:

```javascript
window.matchMedia("(prefers-color-scheme: dark)")
```

Support:

* Light Mode
* Dark Mode

Use Tailwind dark mode classes throughout the application.

---

# Light Mode

Background:

```text
bg-gray-50
```

Cards:

```text
bg-white
```

Text:

```text
text-gray-900
```

Borders:

```text
border-gray-200
```

---

# Dark Mode

Background:

```text
bg-gray-950
```

Cards:

```text
bg-gray-900
```

Text:

```text
text-gray-100
```

Borders:

```text
border-gray-800
```

---

# Header Section

Create a fixed top header containing:

### Left Side

Bootstrap Icon:

```text
bi-chat-dots-fill
```

### Main Title

```text
BRAG
```

### Subtitle

```text
Better RAG Assistant
```

### Status Label

```text
Powered by Mechamaru
```

The header should remain visible while scrolling.

---

# State Management

Create a custom hook:

```javascript
useChat()
```

Manage:

```javascript
history
message
loading
error
```

Example:

```javascript
const {
  history,
  message,
  setMessage,
  loading,
  error,
  sendMessage,
} = useChat();
```

---

# Chat Area

Display messages using:

```javascript
history.map(...)
```

The chat container should:

* Scroll vertically
* Auto-scroll to newest message
* Handle long conversations gracefully

---

# Empty State

When there are no messages, display:

```text
Welcome to BRAG
```

and

```text
Ask Mechamaru anything.
I can retrieve information, reason through problems,
and execute agent workflows.
```

Center this content vertically.

---

# User Messages

Requirements:

* Right aligned
* Rounded message bubble
* Teal accent color

Tailwind:

```text
bg-teal-500
text-white
```

Display:

```text
You
```

above each user message.

---

# Assistant Messages

Requirements:

* Left aligned
* Rounded message bubble
* Adaptive theme styling

Light Mode:

```text
bg-gray-200
```

Dark Mode:

```text
bg-gray-800
```

Display:

```text
Mechamaru
```

above each assistant message.

---

# Loading State

When:

```javascript
loading === true
```

Display:

```text
Mechamaru is thinking...
```

Include:

* Pulsing animation
* Skeleton message placeholder
* Smooth transition

Use Tailwind animation utilities.

---

# Error State

When:

```javascript
error
```

Display a dismissible error banner.

Example:

```text
Something went wrong. Please try again.
```

Style:

```text
bg-red-500
text-white
```

---

# Input Section

Create a sticky bottom input area.

Components:

## Input Field

Bound to:

```javascript
message
```

Requirements:

* Fully responsive
* Rounded full width input
* Keyboard friendly
* Accessible

Placeholder:

```text
Ask Mechamaru anything...
```

---

## Send Button

Use Bootstrap Icon:

```text
bi-send-fill
```

Design:

* Circular button
* Teal background
* Hover animation
* Disabled while loading

Tailwind:

```text
bg-teal-500
hover:bg-teal-600
```

---

# Form Behaviour

Pressing:

```text
Enter
```

should send the message.

Pressing:

```text
Shift + Enter
```

should create a new line.

Disable the form while:

```javascript
loading === true
```

---

# Responsive Requirements

The interface must work correctly on:

* Mobile phones
* Tablets
* Laptops
* Desktop monitors

No horizontal scrolling should occur.

---

# Accessibility

Include:

* Proper button labels
* Keyboard navigation
* Focus states
* Semantic HTML

---

# Animations

Use subtle Tailwind animations only.

Include:

* Hover transitions
* Message appearance transitions
* Loading pulse effect

Avoid excessive animations.

---

# Development Constraints

Use:

* React Functional Components
* JavaScript (.jsx)
* Tailwind CSS
* Bootstrap Icons
* Custom Hooks

Do NOT use:

* TypeScript
* Redux
* Class Components
* Material UI
* Chakra UI

---

# Deliverables

Generate:

```text
src/
├── components/
│   ├── Header.jsx
│   ├── MessageBubble.jsx
│   ├── ChatHistory.jsx
│   ├── ChatInput.jsx
│   └── LoadingBubble.jsx
│
├── hooks/
│   └── useChat.js
│
├── App.jsx
│
└── index.css
```

All code should be production-ready, modular, responsive, and follow modern React best practices.

---
title: Getting Started
description: Invite the bot and create your first ticket panel.
order: 1
---

# Getting Started

Invite Quonex to your server, then make sure it has permission to manage channels and roles in the category you want tickets created under.

## Create your first panel

Run `/panel create` (or `panel create #category @StaffRole <name>` with the prefix) in the channel you want the panel posted in. You'll need:

- A category channel for tickets to be created under
- A staff role that can see and manage tickets
- A name for the panel

Once created, a message with an "Open Ticket" button appears in that channel. Anyone who clicks it gets a private ticket channel.

## Next steps

- Add more staff roles with `/panel addstaffrole`
- Add intake questions with `/panel addquestion` so users answer questions before a ticket opens
- Set a transcript channel with `/panel transcript` so closed tickets leave a record

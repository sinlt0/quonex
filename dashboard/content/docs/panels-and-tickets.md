---
title: Panels & Tickets
description: Managing panels, staff roles, intake forms, and open tickets.
order: 2
---

# Panels & Tickets

## Managing panels

- `/panel list` — see every panel and its ID
- `/panel delete <panelid>` — remove a panel
- `/panel addstaffrole` / `removestaffrole` — a panel can have multiple staff roles; removing the last one is blocked
- `/panel addcategory` / `removecategory` — a panel can have multiple ticket categories (5 on free, 10 on premium), not just one. Discord caps any category at 50 channels, so once a panel gets busy enough to fill one, add another category and new tickets automatically spread to whichever assigned category has the most room. Removing a panel's last category is blocked, same as staff roles.
- `/panel transcript <panelid> #channel` — where closed-ticket transcripts get posted

## Intake forms

Add questions with `/panel addquestion <panelid> <question>`. If a panel has any questions, clicking "Open Ticket" shows a form (a modal) instead of creating the channel immediately. Discord only allows 5 fields per form, so panels with more questions chain multiple forms — answer one set, click Continue, answer the next, and so on until the ticket opens with every answer included.

## Managing an open ticket

Run these inside the ticket channel itself, as a slash command or with the prefix:

- `close` — closes the ticket and generates a transcript. The person who opened it can also close it themselves.
- `claim` / `release` — mark yourself as handling the ticket, or free it back up
- `add @user` / `remove @user` — give or remove another user's access to the channel
- `rename <name>` — rename the ticket channel

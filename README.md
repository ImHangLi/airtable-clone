# Airtable clone

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Tech stack

- [Next.js](https://nextjs.org)
- [Clerk](https://clerk.com)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [Neon](https://neon.tech)
- [Vercel](https://vercel.com)

# Project Checklist

## Setup & Auth

- [X] Create T3 app
- [X] Set up Vercel deployment
- [X] Set up initial Auth via Clerk
- [X] Scaffold simple UI

## Data Models

- [X] Config Neon
- [X] User can create multiple `Bases`
- [ ] `Base` can have multiple `Tables`
- [ ] `Tables` can have multiple `views`
- [X] `Table` has dynamic `Columns` and `Rows`
- [X] `Columns` support `Text` and `Number` types
- [X] New tables seeded with fake data (via faker.js)

## Table UI

- [X] Use TanStack Table for displaying rows/columns
- [X] Editable cells with smooth tabbing
- [X] Add columns dynamically

## Performance

- [X] Use TanStack Virtualizer for rows
- [X] Infinite scroll via tRPC + pagination
- [X] Button to add 100k rows
- [X] Smooth scroll with 100k+ rows
- [X] Loading states while fetching
- [X] Performance holds up to 1M+ rows (i believe)

## Search, Filter, Sort (DB-Level)

- [ ] Search all cells
- [ ] Filter:
  - [ ] Text: contains, not contains, is empty, is not empty, equals
  - [ ] Number: >, <, =
- [ ] Sort:
  - [ ] Text: A→Z, Z→A
  - [ ] Number: ↑ ↓
- [ ] All logic runs on the database

## Views

- [ ] Create & save table views
- [ ] Views store filters, sorts, hidden columns
- [ ] Show/hide and search columns

## Final

...

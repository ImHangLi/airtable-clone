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

- [x] Create T3 app
- [x] Set up Vercel deployment
- [x] Set up initial Auth via Clerk
- [x] Scaffold simple UI

## Data Models

- [x] Config Neon
- [x] User can create multiple `Bases`
- [x] `Table` has dynamic `Columns` and `Rows`
- [x] `Columns` support `Text` and `Number` types
- [x] New tables seeded with fake data (via faker.js)

## Table UI

- [x] Use TanStack Table for displaying rows/columns
- [x] Editable cells with smooth tabbing
- [x] Add columns dynamically

## Performance

- [x] Use TanStack Virtualizer for rows
- [x] Infinite scroll via tRPC + pagination
- [x] Button to add 100k rows
- [x] Smooth scroll with 100k+ rows
- [x] Loading states while fetching
- [x] Performance holds up to 1M+ rows (i believe)

## Search, Filter, Sort (DB-Level)

- [x] Search all cells
- [x] Filter:
  - [x] Text: contains, not contains, is empty, is not empty, equals
  - [x] Number: >, <, =
- [x] Sort:
  - [x] Text: A→Z, Z→A
  - [x] Number: ↑ ↓
- [x] All logic runs on the database

## Views

- [x] Create & save table views
- [x] Multiple tables per base
- [x] Multiple views per table
- [x] Views store filters, sorts, hidden columns
- [x] Show/hide and search columns

## Final

- [ ] User test to find bugs
- [ ] Make it more like a product with better UX and performance

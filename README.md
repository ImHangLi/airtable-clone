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

- [ ] Config Neon
- [ ] User can create multiple `Bases`
- [ ] `Base` can have multiple `Tables`
- [ ] `Table` has dynamic `Columns` and `Rows`
- [ ] `Columns` support `Text` and `Number` types
- [ ] New tables seeded with fake data (via faker.js)

## Table UI

- [ ] Use TanStack Table for displaying rows/columns
- [ ] Editable cells with smooth tabbing
- [ ] Add columns dynamically

## Performance

- [ ] Use TanStack Virtualizer for rows
- [ ] Infinite scroll via tRPC + pagination
- [ ] Button to add 100k rows
- [ ] Smooth scroll with 100k+ rows
- [ ] Loading states while fetching
- [ ] Performance holds up to 1M+ rows

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

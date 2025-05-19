## tRPC and Clerk
We pass the auth object through the context to the tRPC procedure.

```ts
const createContext = async (req: NextRequest) => {
  // Get the auth session
  return createTRPCContext({
    headers: req.headers,
    auth: await auth(),
  });
};
```

Alongside with protectedProcedure, we can protect the routes from unauthenticated users.


## Database schema and tRPC endpoints design
Background:
- HomePage shows all the bases and the user can create/delete a new base.
- User can go to base page with two ways:
  - Create the base
  - Click the base on HomePage
- The routine is always: Navigate to /app{baseId}, showing the base skeleton immediately, and then redirects to actual tables/view.
- On a base page, user can create/edit/delete a new table or view, but there's always one stays.
- Url structure: /{baseId}/{tableId}/{viewId}
- When adding new table, the table will be created with a default view. The UI shows a new table before the url is updated.
- Each table corresponds to a different view, so {tableId} and {viewId} both updates when navigating to different table.





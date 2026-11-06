export default {
  GET_IDENTITIES: "/identities",
  GET_IDENTITIES_BY_ID: "/identities/id/:id",
  GET_IDENTITIES_BY_NAME: "/identities/name/:name",
  GET_ITEMS: "/items",
  GET_ITEMS_BY_ID: "/items/id/:id",
  GET_SEARCH: "/search/:term",
  GET_ME: "/me",
  POST: "/",
  GET_MESSAGES: "/messages/:id"
} as const

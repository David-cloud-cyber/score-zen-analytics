import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/football")({ loader: () => { throw redirect({ to: "/blog/categorie/$categorie", params: { categorie: "actualites" } }); } });

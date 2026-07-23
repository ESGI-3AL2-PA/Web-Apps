import { initServer } from "@ts-rest/express";
import { listingsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import { callerCanReadDistrict, resolveCallerListDistrict } from "../../middleware/district-scope.js";
import { getListingsUseCase } from "../../use-cases/listings/get-listings.use-case.js";
import { getListingByIdUseCase } from "../../use-cases/listings/get-listing-by-id.use-case.js";
import { createListingUseCase } from "../../use-cases/listings/create-listing.use-case.js";
import { updateListingUseCase } from "../../use-cases/listings/update-listing.use-case.js";
import { deleteListingUseCase } from "../../use-cases/listings/delete-listing.use-case.js";

const s = initServer();

/**
 * Router ts-rest des annonces d'entraide (offres/demandes de service au sein d'un
 * quartier). Les annonces sont publiques DANS un quartier mais cloisonnées entre
 * quartiers ; les écritures propagent aussi des relations dans le graphe.
 */
export const listingsRouter = s.router(listingsContract, {
  // GET /listings — liste paginée, bornée au(x) quartier(s) lisibles par l'appelant.
  getListings: async ({ query: { page, limit, search, status, districtId, authorId, tag, sort }, req }) => {
    const scope = await resolveCallerListDistrict(req.user!, districtId, resolve("user"));
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    const result = await getListingsUseCase(resolve("listing"))({
      search,
      status,
      districtId: scope.districtId,
      authorId,
      tag,
      sort,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  // GET /listings/:id — détail d'une annonce.
  getListingById: async ({ params: { id }, req }) => {
    const listing = await getListingByIdUseCase(resolve("listing"))({ id });
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    // Les annonces sont publiques DANS un quartier, pas entre quartiers. 404 (et non 403)
    // pour ne pas divulguer l'existence d'une annonce voisine.
    if (!(await callerCanReadDistrict(req.user!, [listing.districtId], resolve("user")))) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  // POST /listings — crée une annonce. L'auteur et le quartier sont dérivés côté
  // serveur depuis l'utilisateur appelant, jamais depuis le client.
  createListing: async ({ body, req }) => {
    // Annoté pour que resolve("user") reçoive un type contextuel — sans ça, TS infère
    // `never` ici dans le contexte de handler générique de ts-rest (ça marche ailleurs
    // car le résultat alimente un paramètre de cas d'usage typé).
    const userRepo: IUserRepository = resolve("user");
    const author = await userRepo.getUserById(req.user!.sub);
    if (!author) {
      return { status: 404, body: { message: "Author not found" } };
    }
    const newListing = await createListingUseCase(
      resolve("listing"),
      resolve("graph"),
    )({
      ...body,
      authorId: author.id,
      districtId: author.districtId,
    });
    return { status: 201, body: newListing };
  },

  // PATCH /listings/:id — met à jour une annonce. Autorisation propriétaire/admin
  // assurée par le middleware contract-metadata.
  updateListing: async ({ params: { id }, body }) => {
    const listing = await updateListingUseCase(resolve("listing"))(id, body);
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  // DELETE /listings/:id — supprime une annonce (et nettoie le graphe).
  deleteListing: async ({ params: { id } }) => {
    const deleted = await deleteListingUseCase(resolve("listing"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 204, body: undefined };
  },

  // GET /listings/active-count — nombre d'annonces actives dans le quartier ciblé.
  getActiveListingsCount: async ({ query: { districtId }, req }) => {
    const scope = await resolveCallerListDistrict(req.user!, districtId, resolve("user"));
    if ("empty" in scope) {
      return { status: 200, body: { count: 0 } };
    }
    // Annoté pour que resolve("listing") reçoive un type contextuel — sans ça, TS
    // infère `never` dans ce handler nu (même raison que l'annotation userRepo de createListing).
    const listingRepo: IListingRepository = resolve("listing");
    const count = await listingRepo.countActiveListings(scope.districtId);
    return { status: 200, body: { count } };
  },
});

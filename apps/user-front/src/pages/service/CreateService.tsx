import { createListing } from "../../api-service/listings.service";
import ListingForm from "../../component/ListingForm";

// Page de création — délègue tout le rendu et la logique au composant
// réutilisable `ListingForm`. Le select des types est désormais alimenté
// dynamiquement par les tags (voir ListingForm).
function CreateService() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Créer une annonce</h1>
      <ListingForm onSubmit={async (data) => void (await createListing(data))} submitLabel="Créer le service" />
    </div>
  );
}

export default CreateService;

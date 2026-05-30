import type { ListingType } from "../api-service/api";

const CATEGORIES: ListingType[] = [
    "Jardinage",
    "Bricolage",
    "Garde d'enfants",
    "Cuisine",
    "Transport",
    "Animaux",
    "Informatique",
];

type FilterBarProps = {
    selectedType: ListingType | "";
    onChange: (type: ListingType | "") => void;
};

const FilterBar = ({ selectedType, onChange }: FilterBarProps) => {
    const toggle = (cat: ListingType) => {
        onChange(selectedType === cat ? "" : cat);
    };

    return (
        <div className="flex flex-col gap-2 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
            <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">
                Catégorie
            </h3>
            <div className="flex flex-col gap-2">
                {CATEGORIES.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={selectedType === cat}
                            onChange={() => toggle(cat)}
                        />
                        <span className="text-base-content">{cat}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default FilterBar;

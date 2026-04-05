import { useState } from "react";

const Service = () => {
    const [typeAnnonce, setTypeAnnonce] = useState("tout");
    const [categories, setCategories] = useState<string[]>([]);
    const [points, setPoints] = useState(0);

    const toggleCategorie = (cat: string) => {
        setCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="flex">

            {/* Left Barre */}
            <div className="w-64 min-h-screen bg-base-100 p-4 flex flex-col gap-6">

                {/* Type d'annonce */}
                <div className="flex flex-col gap-2 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
                    <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">
                        Type d'annonce
                    </h3>
                    <div className="flex flex-col gap-2">
                        {["tout", "demande", "offre"].map((type) => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="typeAnnonce"
                                    className="radio radio-primary radio-sm"
                                    checked={typeAnnonce === type}
                                    onChange={() => setTypeAnnonce(type)}
                                />
                                <span className="text-base-content capitalize">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Catégorie */}
                <div className="flex flex-col gap-2 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
                    <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">
                        Catégorie
                    </h3>
                    <div className="flex flex-col gap-2">
                        {["Jardinage", "Bricolage", "Garde d'enfants", "Cuisine", "Transport", "Animaux", "Informatique"].map((cat) => (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary checkbox-sm"
                                    checked={categories.includes(cat)}
                                    onChange={() => toggleCategorie(cat)}
                                />
                                <span className="text-base-content">{cat}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Points */}
                <div className="flex flex-col gap-3 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
                    <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">
                        Points
                    </h3>
                    <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={points}
                        onChange={(e) => setPoints(Number(e.target.value))}
                        className="range range-primary range-sm"
                    />
                    <div className="flex justify-between text-xs text-base-content/50">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <span key={n}>{n}</span>
                        ))}
                    </div>
                    <p className="text-sm text-base-content">
                        Max : <span className="font-bold text-primary">{points} pts</span>
                    </p>
                </div>

            </div>

            {/* Main */}
            <div className="flex-1 p-6">MAIN</div>

        </div>
    );
};

export default Service;
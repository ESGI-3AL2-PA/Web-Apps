
const Points = () => {
    const statCardClass = 'bg-[#E29279] card card-xs sm:max-w-sm text-white';

    return (
        <div className='card card-lg sm:max-w-sm bg-[#DA7758] p-5 mt-10 text-white'>
            <h2 className="cad-title text-3xl" >Mon Soldes</h2>
            <p><span className="text-2xl">42 </span>points</p>
            <div className="flex flex-row justify-around mt-5" >
                <div className={statCardClass}>Donnée : <span>8</span></div>
                <div className={statCardClass}>recut : <span>5</span></div>
                <div className={statCardClass}>Echanger : <span>12</span></div>
            </div>
        </div>
    )
}

export default Points
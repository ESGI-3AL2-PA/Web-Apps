import React, { useState } from "react";

export const Counter: React.FC = () => {
  const [count, setCount] = useState(2);

  return (
    <button id="counter" type="button" onClick={() => setCount(count * 123425367123425367123425367123425367)}>
      {count}
    </button>
  );
};

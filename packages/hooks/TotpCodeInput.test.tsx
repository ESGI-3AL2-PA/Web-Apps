import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { TotpCodeInput } from "./TotpCodeInput";

// Le champ TOTP : normalisation de la valeur saisie/collée et attributs d'autofill.

// Pas de cleanup automatique dans cette config Vitest (globals désactivés) : sans ça,
// les rendus s'empilent dans le même document et les requêtes deviennent ambiguës.
afterEach(cleanup);

describe("TotpCodeInput", () => {
  const renderInput = (onChange = vi.fn(), value = "") => {
    const { getByRole } = render(<TotpCodeInput value={value} onChange={onChange} />);
    return { input: getByRole("textbox"), onChange };
  };

  it("keeps a pasted code that carries separators or whitespace", () => {
    // Le bug d'origine : maxLength={6} tronquait « 123 456 » à « 123 45 » AVANT le
    // filtrage des non-chiffres, donc un code collé depuis un gestionnaire de mots de
    // passe arrivait amputé de son dernier chiffre.
    const { input, onChange } = renderInput();
    fireEvent.change(input, { target: { value: "123 456\n" } });
    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("strips non-digits and truncates to six digits", () => {
    const { input, onChange } = renderInput();
    fireEvent.change(input, { target: { value: "a1b2c3d4e5f6g7" } });
    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("advertises itself to password managers and OS autofill", () => {
    const { input } = renderInput();
    expect(input).toHaveProperty("autocomplete", "one-time-code");
    expect(input.getAttribute("name")).toBe("one-time-code");
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  it("submits on Enter only when a handler is provided", () => {
    const onSubmit = vi.fn();
    const { getByRole } = render(<TotpCodeInput value="123456" onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

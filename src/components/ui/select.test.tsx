import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SelectInput } from "@/components/ui/select"

const options = [
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
] as const

describe("SelectInput", () => {
  it("shows custom options, changes value, and submits it with the form", async () => {
    const onValueChange = vi.fn()

    render(
      <form data-testid="form">
        <label htmlFor="tone">Tone</label>
        <SelectInput
          id="tone"
          name="tone"
          defaultValue="professional"
          options={options}
          onValueChange={onValueChange}
        />
      </form>
    )

    const trigger = screen.getByRole("combobox", { name: "Tone" })
    expect(trigger).toHaveTextContent("Professional")

    fireEvent.click(trigger)
    const option = await screen.findByRole("option", { name: "Enthusiastic" })
    fireEvent.mouseMove(option)
    fireEvent.click(option)

    await waitFor(() => {
      expect(trigger).toHaveTextContent("Enthusiastic")
    })
    expect(onValueChange).toHaveBeenCalledWith("enthusiastic")

    const form = screen.getByTestId("form") as HTMLFormElement
    expect(new FormData(form).get("tone")).toBe("enthusiastic")
  })

  it("supports arrow-key navigation and selection", async () => {
    render(
      <SelectInput
        aria-label="Tone"
        defaultValue="professional"
        options={options}
      />
    )

    const trigger = screen.getByRole("combobox", { name: "Tone" })
    fireEvent.keyDown(trigger, { key: "ArrowDown" })

    const nextOption = await screen.findByRole("option", { name: "Enthusiastic" })
    fireEvent.keyDown(screen.getByRole("option", { name: "Professional" }), {
      key: "ArrowDown",
    })
    await waitFor(() => expect(nextOption).toHaveFocus())
    fireEvent.keyDown(nextOption, { key: "Enter" })

    expect(trigger).toHaveTextContent("Enthusiastic")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

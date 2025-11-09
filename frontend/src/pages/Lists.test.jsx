import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UseItUpShelf } from "./Lists";

const baseItem = {
  id: 7,
  name: "Spinach",
  expiry: "2025-11-10",
  quantity: 1,
  listId: 1,
  listName: "Produce",
  suggestion: {
    title: "Sauté greens tonight",
    description: "Quickly wilt with garlic.",
    addOns: ["garlic", "lemon"],
  },
};

describe("UseItUpShelf", () => {
  it("renders expiring items and fires plan handler", async () => {
    const togglePlan = vi.fn();
    const focusList = vi.fn();
    const startShopping = vi.fn();
    render(
      <UseItUpShelf
        items={[baseItem]}
        plannedIds={new Set()}
        onTogglePlan={togglePlan}
        onFocusList={focusList}
        onStartShopping={startShopping}
      />
    );

    expect(screen.getByText("Spinach")).toBeInTheDocument();
    expect(screen.getByText(/Sauté greens tonight/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /plan meal/i }));
    expect(togglePlan).toHaveBeenCalledWith(7);
    await userEvent.click(screen.getByRole("button", { name: /view list/i }));
    expect(focusList).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: /shop now/i }));
    expect(startShopping).toHaveBeenCalledWith(1);
  });

  it("shows planned state and add-on badges", () => {
    render(
      <UseItUpShelf
        items={[baseItem]}
        plannedIds={new Set([baseItem.id])}
      />
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getAllByText(/garlic/i).length).toBeGreaterThan(0);
  });

  it("displays empty state when nothing is expiring", () => {
    render(<UseItUpShelf items={[]} />);
    expect(screen.getByText(/Nothing expiring soon/i)).toBeInTheDocument();
  });
});

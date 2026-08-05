import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Button,
  ButtonLink,
  FreezeDryerCard,
  PageHeader,
  RecentProductionRow,
  SectionHeader,
  StatusBadge,
  StatusBanner,
  Surface,
} from "../components/design-system";

describe("design-system primitives", () => {
  afterEach(cleanup);

  it("renders accessible actions and semantic status treatments", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Surface aria-label="Foundation example">
        <PageHeader
          title="Production"
          description="Manage Production Batches."
          action={<Button onClick={onClick}>New Batch</Button>}
        />
        <StatusBadge tone="success">All clear</StatusBadge>
        <StatusBanner
          tone="danger"
          title="Save failed"
          body="Your changes are still available."
        />
      </Surface>,
    );

    await user.click(screen.getByRole("button", { name: "New Batch" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "Production" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All clear")).toHaveClass("ds-badge--success");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your changes are still available.",
    );
    expect(screen.getByLabelText("Foundation example")).toHaveClass(
      "ds-surface",
    );
    expect(screen.getByLabelText("Foundation example").tagName).toBe("DIV");
  });

  it("keeps secondary and disabled buttons visually distinct", () => {
    render(
      <>
        <Button variant="secondary">Review details</Button>
        <Button disabled>Unavailable</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Review details" })).toHaveClass(
      "ds-button--secondary",
    );
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });

  it("renders reusable Dashboard patterns with accessible links and headings", () => {
    render(
      <MemoryRouter>
        <SectionHeader
          id="freeze-dryers-heading"
          title="Freeze Dryers"
          action={<ButtonLink to="/freeze-dryers">View all</ButtonLink>}
        />
        <FreezeDryerCard
          name="Black"
          status={<StatusBadge tone="success">Idle</StatusBadge>}
          summary="Available for a new Production Batch"
          action={
            <ButtonLink to="/production" variant="secondary">
              Create Production Batch
            </ButtonLink>
          }
        />
        <ul>
          <RecentProductionRow
            batchNumber="Batch 005"
            freezeDryerName="Black"
            started="Jul 8"
            status={<StatusBadge tone="success">Completed</StatusBadge>}
            to="/production/batch-5"
          />
        </ul>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Freeze Dryers" }),
    ).toHaveAttribute("id", "freeze-dryers-heading");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/freeze-dryers",
    );
    expect(screen.getByRole("heading", { name: "Black" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Batch 005" })).toHaveAttribute(
      "href",
      "/production/batch-5",
    );
  });
});

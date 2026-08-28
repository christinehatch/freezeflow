import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorPanel,
  Field,
  FreezeDryerCard,
  LoadingPanel,
  Modal,
  PageHeader,
  NumberField,
  RecentProductionRow,
  SectionHeader,
  StatusBadge,
  StatusBanner,
  Surface,
  SummaryPanel,
  Select,
  Textarea,
  TextField,
  WorkflowStage,
  WorkflowStepper,
} from "../components/design-system";
import { WeightSummary } from "../components/WeightSummary";

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

  it("renders guided workflow progress and a dominant weight balance", () => {
    render(
      <>
        <WorkflowStepper
          label="Packaging progress"
          steps={[
            { id: "source", label: "Choose source", status: "complete" },
            { id: "product", label: "Choose product", status: "current" },
            { id: "packages", label: "Allocate packages", status: "upcoming" },
          ]}
        />
        <WorkflowStage
          description="Select completed Trays."
          stage={2}
          status="current"
          title="Choose product"
        >
          <WeightSummary
            allocatedWeightGrams={75}
            remainingWeightGrams={25}
            selectedWeightGrams={100}
          />
        </WorkflowStage>
      </>,
    );

    expect(
      screen.getByRole("navigation", { name: "Packaging progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Choose product")[0].closest("li"),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("heading", { name: "Choose product" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Remaining to Package").parentElement).toHaveClass(
      "packaging-weight-summary__item--dominant",
      "packaging-weight-summary__item--remaining",
    );
    expect(screen.getByText("25 g")).toBeInTheDocument();
  });

  it("provides a keyboard-accessible form family with rich Select options", async () => {
    const user = userEvent.setup();

    function FormExample() {
      const [source, setSource] = useState("source-1");
      return (
        <form>
          <Field htmlFor="source" label="Product source">
            <Select
              id="source"
              options={[
                {
                  value: "source-1",
                  label: "Source 1",
                  description: "39 g remaining",
                },
                {
                  value: "source-2",
                  label: "Source 2",
                  description: "236 g remaining",
                },
              ]}
              value={source}
              onChange={setSource}
            />
          </Field>
          <Field htmlFor="name" label="Name">
            <TextField id="name" />
          </Field>
          <Field htmlFor="weight" label="Weight">
            <NumberField id="weight" suffix="g" />
          </Field>
          <Field htmlFor="notes" label="Notes" optional>
            <Textarea id="notes" />
          </Field>
        </form>
      );
    }

    render(<FormExample />);
    const select = screen.getByRole("combobox", { name: "Product source" });
    select.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(select).toHaveTextContent("Source 2");
    expect(select).toHaveTextContent("236 g remaining");
    expect(select).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass(
      "ds-input",
    );
    expect(screen.getByRole("spinbutton", { name: "Weight" })).toHaveClass(
      "ds-number-field__input",
    );
    expect(screen.getByRole("textbox", { name: "Notes Optional" })).toHaveClass(
      "ds-textarea",
    );
  });

  it("renders an authoritative summary panel with an emphasized metric", () => {
    render(
      <SummaryPanel
        items={[
          { label: "Packaged", value: "600 g" },
          { label: "Remaining", value: "39 g", emphasis: true },
        ]}
        title="Packaging summary"
      >
        <p>Quart Mylar</p>
      </SummaryPanel>,
    );

    const panel = screen.getByLabelText("Packaging summary");
    expect(panel).toHaveTextContent("Packaged600 g");
    expect(panel).toHaveTextContent("Remaining39 g");
    expect(panel).toHaveTextContent("Quart Mylar");
    expect(screen.getByText("Remaining").parentElement).toHaveClass(
      "ds-summary-panel__metric--emphasis",
    );
  });

  it("renders LoadingPanel, ErrorPanel, and EmptyState with the expected roles and content", () => {
    const onRetry = vi.fn();
    render(
      <>
        <LoadingPanel />
        <LoadingPanel label="Loading Tray…" />
        <ErrorPanel message="Something went wrong." onRetry={onRetry} />
        <EmptyState
          message="No Storage Locations yet."
          action={<Button>Add Storage Location</Button>}
        />
      </>,
    );

    const statusPanels = screen.getAllByRole("status");
    expect(statusPanels).toHaveLength(2);
    expect(statusPanels[0]).toHaveTextContent("Loading…");
    expect(statusPanels[1]).toHaveTextContent("Loading Tray…");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
    expect(screen.getByText("No Storage Locations yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Storage Location" }),
    ).toBeInTheDocument();
  });

  it("omits the ErrorPanel retry action when no onRetry is given", () => {
    render(<ErrorPanel message="Could not load." />);

    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  describe("Modal", () => {
    afterEach(cleanup);

    function ModalHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Open Modal
          </button>
          {isOpen ? (
            <Modal title="Example Modal" onClose={() => setIsOpen(false)}>
              <button type="button">First</button>
              <button type="button">Second</button>
            </Modal>
          ) : null}
        </div>
      );
    }

    it("moves focus into the modal on open and restores it to the trigger on close", async () => {
      const user = userEvent.setup();
      render(<ModalHarness />);

      const trigger = screen.getByRole("button", { name: "Open Modal" });
      trigger.focus();
      await user.click(trigger);

      expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it("traps Tab focus within the modal, wrapping at both ends", async () => {
      const user = userEvent.setup();
      render(<ModalHarness />);

      await user.click(screen.getByRole("button", { name: "Open Modal" }));
      const first = screen.getByRole("button", { name: "First" });
      const second = screen.getByRole("button", { name: "Second" });

      expect(first).toHaveFocus();

      await user.tab();
      expect(second).toHaveFocus();

      await user.tab();
      expect(first).toHaveFocus();

      await user.tab({ shift: true });
      expect(second).toHaveFocus();
    });

    it("locks and restores body scroll while open", async () => {
      const user = userEvent.setup();
      render(<ModalHarness />);

      expect(document.body.style.overflow).not.toBe("hidden");

      await user.click(screen.getByRole("button", { name: "Open Modal" }));
      expect(document.body.style.overflow).toBe("hidden");

      await user.keyboard("{Escape}");
      expect(document.body.style.overflow).not.toBe("hidden");
    });
  });
});

import type { ReactNode } from "react";

import {
  Button,
  PageHeader,
  StatusBadge,
  StatusBanner,
  Surface,
} from "../components/design-system";

const colorTokens = [
  ["Page background", "--ff-color-page-background", "#f4f6f4"],
  ["Surface", "--ff-color-surface", "#ffffff"],
  ["Subtle surface", "--ff-color-surface-subtle", "#eef1ee"],
  ["Primary text", "--ff-color-text-primary", "#15211d"],
  ["Secondary text", "--ff-color-text-secondary", "#55615b"],
  ["Muted text", "--ff-color-text-muted", "#64726b"],
  ["Border", "--ff-color-border", "#e0e4e0"],
  ["Strong border", "--ff-color-border-strong", "#c8d0ca"],
  ["Primary action", "--ff-color-action-primary", "#183c34"],
  ["Primary hover", "--ff-color-action-primary-hover", "#102e28"],
  ["Success background", "--ff-color-success-background", "#ddf4e6"],
  ["Success text", "--ff-color-success-text", "#245b3f"],
  ["Attention background", "--ff-color-attention-background", "#fff3e3"],
  ["Attention text", "--ff-color-attention-text", "#6e4512"],
  ["Danger background", "--ff-color-danger-background", "#fdf0ed"],
  ["Danger text", "--ff-color-danger-text", "#8a3124"],
] as const;

const typographyTokens = [
  [
    "Caption",
    "--ff-font-size-caption",
    "--ff-line-height-caption",
    "Supporting labels and compact status context",
  ],
  [
    "Supporting",
    "--ff-font-size-supporting",
    "--ff-line-height-supporting",
    "Quiet context that helps explain the current state.",
  ],
  [
    "Body",
    "--ff-font-size-body",
    "--ff-line-height-body",
    "Production information should remain comfortable to read.",
  ],
  [
    "Section title",
    "--ff-font-size-section-title",
    "--ff-line-height-section-title",
    "Freeze dryers",
  ],
  [
    "Page title",
    "--ff-font-size-page-title",
    "--ff-line-height-page-title",
    "Production",
  ],
  [
    "Display",
    "--ff-font-size-display",
    "--ff-line-height-display",
    "Everything is on track.",
  ],
] as const;

const spacingTokens = [
  ["4px", "--ff-space-1"],
  ["8px", "--ff-space-2"],
  ["12px", "--ff-space-3"],
  ["16px", "--ff-space-4"],
  ["20px", "--ff-space-5"],
  ["24px", "--ff-space-6"],
  ["32px", "--ff-space-8"],
  ["40px", "--ff-space-10"],
  ["48px", "--ff-space-12"],
  ["56px", "--ff-space-14"],
  ["64px", "--ff-space-16"],
] as const;

const radii = [
  ["Small", "--ff-radius-small", "8px"],
  ["Medium", "--ff-radius-medium", "10px"],
  ["Large", "--ff-radius-large", "16px"],
] as const;

export function DesignSystemPage() {
  return (
    <div className="design-gallery">
      <div className="design-gallery__intro">
        <PageHeader
          eyebrow="Developer tool · design system foundation"
          title="Freezeflow interface foundations"
          description="A safe place to review semantic tokens and the first reusable visual primitives. This gallery does not change product workflows."
          action={<Button>Primary action</Button>}
        />
        <StatusBanner
          tone="calm"
          title="Foundation only"
          body="The Dashboard is the first product-page pilot. Production, Freeze Dryers, Packaging, and Inventory retain their existing presentation."
        />
      </div>

      <GallerySection
        title="Color tokens"
        description="Semantic roles keep page code independent from raw color names."
      >
        <div className="design-gallery__grid">
          {colorTokens.map(([name, token, value]) => (
            <article className="design-gallery__swatch" key={token}>
              <div
                aria-label={`${name} color ${value}`}
                className="design-gallery__swatch-color"
                style={{ background: `var(${token})` }}
              />
              <div className="design-gallery__swatch-copy">
                <p className="design-gallery__swatch-name">{name}</p>
                <p className="design-gallery__token">
                  {token} · {value}
                </p>
              </div>
            </article>
          ))}
        </div>
      </GallerySection>

      <GallerySection
        title="Typography hierarchy"
        description="Hierarchy comes from scale, weight, and spacing—not from decorative styling."
      >
        <Surface className="design-gallery__stack">
          {typographyTokens.map(([name, size, lineHeight, sample]) => (
            <p
              className="design-gallery__type-sample"
              key={size}
              style={{
                fontSize: `var(${size})`,
                lineHeight: `var(${lineHeight})`,
              }}
            >
              <span className="design-gallery__type-label">{name}</span>
              {sample}
            </p>
          ))}
        </Surface>
      </GallerySection>

      <GallerySection
        title="Spacing scale"
        description="The scale begins at 4px and grows predictably for controls, components, and page regions."
      >
        <Surface className="design-gallery__stack">
          {spacingTokens.map(([label, token]) => (
            <div className="design-gallery__spacing-row" key={token}>
              <p className="design-gallery__token">
                {label} · {token}
              </p>
              <div
                className="design-gallery__spacing-bar"
                style={{ width: `var(${token})` }}
              />
            </div>
          ))}
        </Surface>
      </GallerySection>

      <GallerySection
        title="Corner radii"
        description="Three radii distinguish compact controls, actions, and larger surfaces."
      >
        <div className="design-gallery__grid">
          {radii.map(([name, token, value]) => (
            <div
              className="design-gallery__radius-sample"
              key={token}
              style={{ borderRadius: `var(${token})` }}
            >
              <p className="design-gallery__token">
                {name} · {value}
              </p>
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection
        title="Buttons and status badges"
        description="One dominant action and quieter secondary choices keep the next step obvious."
      >
        <Surface className="design-gallery__stack">
          <div className="design-gallery__actions">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary action</Button>
            <Button disabled>Disabled action</Button>
          </div>
          <div className="design-gallery__actions">
            <StatusBadge>Completed</StatusBadge>
            <StatusBadge tone="success">All clear</StatusBadge>
            <StatusBadge tone="attention">Needs attention</StatusBadge>
            <StatusBadge tone="danger">Action required</StatusBadge>
          </div>
        </Surface>
      </GallerySection>

      <GallerySection
        title="Status surfaces"
        description="Use one focused surface to communicate the state that matters now."
      >
        <div className="design-gallery__stack">
          <StatusBanner
            tone="calm"
            title="Everything is on track"
            body="Both Freeze Dryers are ready whenever you are."
          />
          <StatusBanner
            tone="attention"
            title="Batch 007 is ready for a Weight Check"
            body="Black Freeze Dryer · four Trays · last checked two hours ago."
          />
          <StatusBanner
            tone="success"
            title="Production Batch completed"
            body="The completed Trays are ready for Packaging."
          />
          <StatusBanner
            tone="danger"
            title="The change could not be saved"
            body="Your entered information is still available. Review the message and try again."
          />
        </div>
      </GallerySection>

      <GallerySection
        title="Page and card examples"
        description="Orient first, then reveal supporting content with quieter visual weight."
      >
        <Surface className="design-gallery__stack">
          <PageHeader
            title="Packaging"
            description="Turn completed product into labeled Packages while preserving source Tray traceability."
            action={<Button>Start Packaging</Button>}
          />
          <Surface>
            <h3 className="design-gallery__example-card-title">
              Black Freeze Dryer
            </h3>
            <p className="design-gallery__example-card-copy">
              Available for a new Production Batch.
            </p>
            <div className="design-gallery__actions">
              <StatusBadge tone="success">Idle</StatusBadge>
              <Button variant="secondary">Create Batch</Button>
            </div>
          </Surface>
        </Surface>
      </GallerySection>
    </div>
  );
}

function GallerySection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="design-gallery__section">
      <h2 className="design-gallery__section-heading">{title}</h2>
      <p className="design-gallery__section-copy">{description}</p>
      {children}
    </section>
  );
}

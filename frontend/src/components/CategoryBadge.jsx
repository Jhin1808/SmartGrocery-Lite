import React from "react";

const TOP_LEVEL_META = {
  dairy:     { color: "var(--cat-dairy,     #60a5fa)", icon: "bi-cup-straw",  label: "Dairy" },
  produce:   { color: "var(--cat-produce,   #34d399)", icon: "bi-tree",       label: "Produce" },
  meat:      { color: "var(--cat-meat,      #f87171)", icon: "bi-egg-fried",  label: "Meat" },
  seafood:   { color: "var(--cat-seafood,   #38bdf8)", icon: "bi-water",      label: "Seafood" },
  bakery:    { color: "var(--cat-bakery,    #d4a373)", icon: "bi-basket",     label: "Bakery" },
  pantry:    { color: "var(--cat-pantry,    #fbbf24)", icon: "bi-box-seam",   label: "Pantry" },
  frozen:    { color: "var(--cat-frozen,    #22d3ee)", icon: "bi-snow",       label: "Frozen" },
  beverages: { color: "var(--cat-beverages, #a78bfa)", icon: "bi-cup-hot",    label: "Beverages" },
  snacks:    { color: "var(--cat-snacks,    #facc15)", icon: "bi-bag-fill",   label: "Snacks" },
  condiments:{ color: "var(--cat-cond,      #fb923c)", icon: "bi-droplet",    label: "Condiments" },
  eggs:      { color: "var(--cat-eggs,      #fde68a)", icon: "bi-egg",        label: "Eggs" },
};

const SUBCATEGORY_LABEL = {
  "fat-free": "Fat-Free",
  "fat-reduced": "Reduced Fat",
  "low-fat": "Low Fat",
  "whole": "Whole",
  "lactose-free": "Lactose-Free",
  "dairy-free": "Dairy-Free",
  "organic": "Organic",
  "gluten-free": "Gluten-Free",
};

const DEFAULT = { color: "var(--cat-default, #94a3b8)", icon: "bi-tag", label: "Other" };

export function topLevelFromCanonical(canonical) {
  if (!canonical) return null;
  const head = String(canonical).split(".")[0];
  return TOP_LEVEL_META[head] ? head : null;
}

export function categoryColor(canonical) {
  const tl = topLevelFromCanonical(canonical);
  return (tl && TOP_LEVEL_META[tl].color) || DEFAULT.color;
}

export function categoryIcon(canonical) {
  const tl = topLevelFromCanonical(canonical);
  return (tl && TOP_LEVEL_META[tl].icon) || DEFAULT.icon;
}

export function categoryLabel(category) {
  if (!category) return null;
  const tl = topLevelFromCanonical(category);
  if (tl) return TOP_LEVEL_META[tl].label;
  return category;
}

export default function CategoryBadge({ category, subcategory, size = "sm" }) {
  if (!category && !subcategory) return null;
  const tl = topLevelFromCanonical(category);
  const color = (tl && TOP_LEVEL_META[tl].color) || DEFAULT.color;
  const icon = (tl && TOP_LEVEL_META[tl].icon) || DEFAULT.icon;
  const sub = subcategory && SUBCATEGORY_LABEL[subcategory]
    ? SUBCATEGORY_LABEL[subcategory]
    : subcategory;
  const cls = size === "lg" ? "lm-cat-badge lm-cat-badge--lg" : "lm-cat-badge";
  return (
    <span className={cls} style={{ "--cat-color": color }}>
      <i className={`bi ${icon}`} />
      <span>{categoryLabel(category)}</span>
      {sub && <span className="lm-cat-badge__sub">{sub}</span>}
    </span>
  );
}

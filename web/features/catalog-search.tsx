import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function CatalogSearch({
  value,
  onChange,
  city,
  action,
}: {
  value: string;
  onChange: (v: string) => void;
  city: string;
  action: string;
}) {
  const [items, setItems] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setActive(-1);
    if (value.trim().length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      api(
        `/catalog/suggestions?${new URLSearchParams({ q: value, ...(city ? { city } : {}) })}`,
        { signal: controller.signal },
      )
        .then((r) => {
          if (!controller.signal.aborted)
            setItems(r.groups.flatMap((g: any) => g.items));
        })
        .catch(() => {
          if (!controller.signal.aborted) setItems([]);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, city]);
  function select(index: number) {
    if (items[index]) location.assign(`/listing/${items[index].id}`);
  }
  return (
    <form
      className="search"
      action={action}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span aria-hidden="true">⌕</span>
      <label className="sr-only" htmlFor="search">
        Search movies, events and sports
      </label>
      <input
        id="search"
        name="q"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="catalog-suggestions"
        aria-expanded={open && items.length > 0}
        aria-activedescendant={
          active >= 0 && open ? `suggestion-${active}` : undefined
        }
        autoComplete="off"
        maxLength={100}
        placeholder="Search for Movies, Events and Sports"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          } else if (
            (e.key === "ArrowDown" || e.key === "ArrowUp") &&
            items.length
          ) {
            e.preventDefault();
            setOpen(true);
            setActive((n) =>
              n < 0
                ? e.key === "ArrowDown"
                  ? 0
                  : items.length - 1
                : (n + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length,
            );
          } else if (e.key === "Enter" && open && active >= 0) {
            e.preventDefault();
            select(active);
          }
        }}
      />
      <input type="hidden" name="city" value={city} />
      <button type="submit" className="sr-only">
        Search
      </button>
      <div
        id="catalog-suggestions"
        role="listbox"
        aria-label="Published listing suggestions"
        className="catalog-suggestions"
        hidden={!open || !items.length}
      >
        {items.map((item, index) => (
          <div
            role="option"
            aria-selected={active === index}
            id={`suggestion-${index}`}
            key={item.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(index)}
          >
            <strong>{item.title}</strong>
            <small>
              {item.kind} · {item.city}
              {item.language ? ` · ${item.language}` : ""}
            </small>
          </div>
        ))}
      </div>
    </form>
  );
}
export function CatalogFilters({
  facets,
  city,
  search,
}: {
  facets: Record<string, string[]>;
  city: string;
  search: string;
}) {
  const params = new URLSearchParams(location.search);
  return (
    <details open>
      <summary>Filters and sorting</summary>
      <form action={location.pathname}>
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="q" value={search} />
        {["language", "genre", "format"].map((key) => {
          const selected = params.get(key) ?? "",
            options = Array.from(
              new Set([
                ...(facets[key] ?? []),
                ...(selected ? [selected] : []),
              ]),
            );
          return (
            <label key={key}>
              {key}
              <select name={key} defaultValue={selected}>
                <option value="">All</option>
                {options.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label>
          Sort by
          <select name="sort" defaultValue={params.get("sort") ?? "newest"}>
            <option value="newest">Recently added</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>
      <div className="chips">
        {["language", "genre", "format"]
          .filter((k) => params.get(k))
          .map((k) => {
            const next = new URLSearchParams(params);
            next.delete(k);
            next.delete("after");
            return (
              <a
                key={k}
                href={`${location.pathname}?${next}`}
                aria-label={`Remove ${k} filter ${params.get(k)}`}
              >
                {k}: {params.get(k)} ×
              </a>
            );
          })}
        <a href={`${location.pathname}?city=`}>Clear all filters</a>
      </div>
    </details>
  );
}

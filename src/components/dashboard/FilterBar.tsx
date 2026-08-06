'use client';

import { useState } from 'react';

import { ko } from '@/content/ko';

export interface FilterBarProps {
  years: number[];
  year: number;
  onYearChange(y: number): void;
  levels: { value: string; label: string }[];
  level: string;
  onLevelChange(v: string): void;
  metric: 'count' | 'rate';
  onMetricChange(m: 'count' | 'rate'): void;
  selectedRegions: string[];
  onRegionsChange(r: string[]): void;
  regions: { value: string; label: string }[];
  studentTypeNotice: string;
}

export function FilterBar({
  years,
  year,
  onYearChange,
  levels,
  level,
  onLevelChange,
  metric,
  onMetricChange,
  selectedRegions,
  onRegionsChange,
  regions,
  studentTypeNotice,
}: FilterBarProps) {
  const [limitReached, setLimitReached] = useState(false);
  const otherLevel = levels.find((item) => item.value === 'other');

  function handleRegionChange(value: string) {
    if (selectedRegions.includes(value)) {
      setLimitReached(false);
      onRegionsChange(selectedRegions.filter((region) => region !== value));
      return;
    }
    if (selectedRegions.length >= 3) {
      setLimitReached(true);
      return;
    }
    setLimitReached(false);
    onRegionsChange([...selectedRegions, value]);
  }

  return (
    <section className="space-y-4" aria-labelledby="filter-bar-title">
      <h2 id="filter-bar-title" className="text-lg font-medium">
        {ko.filters.title}
      </h2>

      <div className="viz-controls">
        <label className="form-label" htmlFor="filter-year">
          {ko.filters.year}
          <select
            id="filter-year"
            className="form-select"
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
          >
            {years.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="form-label" htmlFor="filter-school-level">
          {ko.filters.schoolLevel}
          <select
            id="filter-school-level"
            className="form-select"
            value={level}
            onChange={(event) => onLevelChange(event.target.value)}
          >
            {levels.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-1">
          <legend className="form-label">{ko.filters.metric}</legend>
          <div className="inline-flex" role="group" aria-label={ko.filters.metric}>
            <button
              type="button"
              className="btn rounded-r-none"
              aria-pressed={metric === 'count'}
              onClick={() => onMetricChange('count')}
            >
              {ko.filters.metrics.count}
            </button>
            <button
              type="button"
              className="btn -ml-px rounded-l-none"
              aria-pressed={metric === 'rate'}
              onClick={() => onMetricChange('rate')}
            >
              {ko.filters.metrics.rate}
            </button>
          </div>
        </fieldset>
      </div>

      <fieldset className="space-y-2" aria-describedby="region-selection-note">
        <legend className="form-label inline-flex flex-row flex-wrap items-baseline gap-2">
          {ko.filters.regions}
          <span
            id="region-selection-note"
            className="text-small font-normal text-[var(--km-color-text-muted)]"
          >
            {ko.filters.maxRegions}
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {regions.map((region) => {
            const inputId = `filter-region-${region.value}`;
            return (
              <label className="form-check" htmlFor={inputId} key={region.value}>
                <input
                  id={inputId}
                  className="form-check-input"
                  type="checkbox"
                  checked={selectedRegions.includes(region.value)}
                  onChange={() => handleRegionChange(region.value)}
                />
                <span className="form-check-label">{region.label}</span>
              </label>
            );
          })}
        </div>
        {limitReached ? (
          <p className="text-small text-destructive" role="alert">
            {ko.errors.tooManyRegions}
          </p>
        ) : null}
      </fieldset>

      <p className="text-small text-[var(--km-color-text-muted)]">{studentTypeNotice}</p>

      {level === 'other' ? (
        <span className="viz-badge" role="status">
          {otherLevel?.label ?? ko.filters.schoolLevels.other}: {ko.filters.otherSchoolLevelNote}
        </span>
      ) : null}
    </section>
  );
}

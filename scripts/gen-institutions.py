#!/usr/bin/env python3
"""Generate platform/supabase/027_institutions.sql from platform/data/institutions-source.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "platform/data/institutions-source.json"
OUT = ROOT / "platform/supabase/027_institutions.sql"

SUFFIXES = [
    " School of Medicine and Health Sciences",
    " School of Medicine and Public Health",
    " School of Medicine and Dentistry",
    " School of Medicine and Medical Engineering",
    " College of Medicine and Life Sciences",
    " College of Medicine and Dentistry",
    " College of Osteopathic Medicine of the Pacific",
    " College of Osteopathic Medicine",
    " School of Osteopathic Medicine",
    " College of Allopathic Medicine",
    " School of Medicine",
    " College of Medicine",
    " Medical School",
    " Medical College",
    " Faculty of Medicine and Health Sciences",
    " Faculty of Medicine and Dentistry",
    " Faculty of Medicine",
    " Faculté de médecine et des sciences de la santé",
    " Faculté de médecine",
    " Temerty Faculty of Medicine",
    " Max Rady College of Medicine",
    " Cumming School of Medicine",
    " Schulich School of Medicine & Dentistry",
    " Physician Associate Program",
    " School of Nursing",
    " School of Public Health",
]

SHORT_NAMES = {
    "University of California, San Francisco School of Medicine": "UCSF",
    "David Geffen School of Medicine at UCLA": "UCLA",
    "University of California, San Diego School of Medicine": "UCSD",
    "University of California, Davis School of Medicine": "UC Davis",
    "University of California, Irvine School of Medicine": "UC Irvine",
    "University of California, Riverside School of Medicine": "UC Riverside",
    "Yale School of Medicine": "Yale",
    "Harvard Medical School": "Harvard",
    "Johns Hopkins University School of Medicine": "Johns Hopkins",
    "Perelman School of Medicine at the University of Pennsylvania": "Penn",
    "Columbia University Vagelos College of Physicians and Surgeons": "Columbia",
    "Weill Cornell Medical College": "Weill Cornell",
    "NYU Grossman School of Medicine": "NYU",
    "Icahn School of Medicine at Mount Sinai": "Mount Sinai",
    "Stanford University School of Medicine": "Stanford",
    "Keck School of Medicine of University of Southern California": "USC Keck",
    "Northwestern University Feinberg School of Medicine": "Northwestern",
    "University of Chicago Division of the Biological Sciences The Pritzker School of Medicine": "Pritzker",
    "University of Michigan Medical School": "Michigan",
    "Mayo Clinic Alix School of Medicine": "Mayo",
    "Duke University School of Medicine": "Duke",
    "Vanderbilt University School of Medicine": "Vanderbilt",
    "Washington University in St. Louis School of Medicine": "WashU",
    "Baylor College of Medicine School of Medicine": "Baylor",
    "University of Texas Southwestern Medical School": "UT Southwestern",
    "McGovern Medical School at UTHealth Houston": "McGovern",
    "Geisel School of Medicine at Dartmouth": "Dartmouth",
    "The Warren Alpert Medical School at Brown University": "Brown",
    "Boston University Aram V. Chobanian & Edward Avedisian School of Medicine": "Boston University",
    "University of Massachusetts T.H. Chan School of Medicine": "UMass",
    "Albert Einstein College of Medicine": "Einstein",
    "NOSM University": "NOSM",
    "St. George's University School of Medicine": "SGU",
    "Ross University School of Medicine": "Ross",
    "American University of the Caribbean School of Medicine": "AUC",
    "Yale Physician Associate Program": "Yale PA",
    "Yale School of Nursing": "Yale Nursing",
    "Yale School of Public Health": "YSPH",
}

EXTRA_ALIASES = {
    "University of California, San Francisco School of Medicine": [
        "UCSF",
        "UCSF School of Medicine",
        "UCSF SOM",
        "UC San Francisco",
        "UC San Francisco School of Medicine",
        "University of California San Francisco",
        "University of California San Francisco School of Medicine",
        "University of California, San Francisco",
        "UCSF Medical School",
        "San Francisco School of Medicine",
    ],
    "Yale School of Medicine": [
        "Yale",
        "YSM",
        "Yale University",
        "Yale University School of Medicine",
        "Yale Med",
        "Yale SOM",
        "Yale Medical School",
    ],
    "David Geffen School of Medicine at UCLA": [
        "UCLA",
        "UCLA School of Medicine",
        "DGSOM",
        "David Geffen School of Medicine",
        "University of California Los Angeles School of Medicine",
        "University of California, Los Angeles School of Medicine",
    ],
    "University of California, San Diego School of Medicine": [
        "UCSD",
        "UC San Diego",
        "UC San Diego School of Medicine",
    ],
    "Harvard Medical School": ["HMS", "Harvard", "Harvard Med"],
    "Johns Hopkins University School of Medicine": ["Hopkins", "JHUSOM", "Johns Hopkins"],
    "Stanford University School of Medicine": ["Stanford Med", "Stanford SOM"],
    "Perelman School of Medicine at the University of Pennsylvania": [
        "UPenn",
        "Penn Med",
        "Perelman",
        "University of Pennsylvania School of Medicine",
    ],
    "Columbia University Vagelos College of Physicians and Surgeons": [
        "Columbia P&S",
        "Columbia VP&S",
        "P&S",
        "Columbia University College of Physicians and Surgeons",
    ],
    "Icahn School of Medicine at Mount Sinai": ["ISMMS", "Mount Sinai School of Medicine"],
    "NYU Grossman School of Medicine": ["NYU School of Medicine", "NYU Med"],
    "Weill Cornell Medical College": ["Weill Cornell Medicine", "Cornell Medical School"],
    "Keck School of Medicine of University of Southern California": [
        "Keck",
        "USC School of Medicine",
        "University of Southern California School of Medicine",
    ],
    "University of Chicago Division of the Biological Sciences The Pritzker School of Medicine": [
        "Pritzker",
        "University of Chicago Pritzker School of Medicine",
        "UChicago Pritzker",
    ],
    "Northwestern University Feinberg School of Medicine": ["Feinberg", "Northwestern Med"],
    "Washington University in St. Louis School of Medicine": [
        "WashU",
        "WUSM",
        "Washington University School of Medicine",
        "Washington University in St. Louis",
    ],
    "Baylor College of Medicine School of Medicine": ["Baylor College of Medicine", "BCM"],
    "University of Texas Southwestern Medical School": [
        "UTSW",
        "UT Southwestern Medical School",
        "University of Texas Southwestern",
    ],
    "McGovern Medical School at UTHealth Houston": [
        "UTHealth",
        "UT Houston",
        "McGovern Medical School",
        "UTHealth John P. and Katherine G. McGovern Medical School",
    ],
    "Mayo Clinic Alix School of Medicine": ["Mayo Medical School", "Mayo Clinic School of Medicine"],
    "Boston University Aram V. Chobanian & Edward Avedisian School of Medicine": [
        "Boston University School of Medicine",
        "BUSM",
        "BU School of Medicine",
    ],
    "University of Massachusetts T.H. Chan School of Medicine": [
        "UMass Chan",
        "University of Massachusetts Medical School",
        "UMass Medical School",
    ],
    "University of Alabama at Birmingham Marnix E. Heersink School of Medicine": [
        "UAB",
        "Heersink",
        "University of Alabama School of Medicine",
        "UAB School of Medicine",
    ],
    "Frederick P. Whiddon College of Medicine at the University of South Alabama": [
        "University of South Alabama College of Medicine",
        "USA College of Medicine",
        "Whiddon College of Medicine",
    ],
    "University of Arizona College of Medicine – Tucson": [
        "University of Arizona College of Medicine-Tucson",
        "University of Arizona College of Medicine Tucson",
        "UA COM Tucson",
    ],
    "The University of Arizona College of Medicine Phoenix": [
        "University of Arizona College of Medicine Phoenix",
        "UA COM Phoenix",
    ],
    "Geisel School of Medicine at Dartmouth": ["Dartmouth Medical School", "Geisel"],
    "The Warren Alpert Medical School at Brown University": [
        "Alpert Medical School",
        "Brown Medical School",
        "Warren Alpert Medical School",
    ],
    "George Washington University School of Medicine and Health Sciences": [
        "GW SMHS",
        "GWU School of Medicine",
        "George Washington University Medical School",
    ],
    "Western University of Health Sciences College of Osteopathic Medicine of the Pacific": [
        "WesternU COMP",
        "COMP",
        "COMP-Northwest",
        "Western University COMP",
        "Western University of Health Sciences College of Osteopathic Medicine of the Pacific-Northwest",
    ],
    "Philadelphia College of Osteopathic Medicine": ["PCOM"],
    "Lake Erie College of Osteopathic Medicine": ["LECOM"],
    "Edward Via College of Osteopathic Medicine": ["VCOM"],
    "New York Institute of Technology College of Osteopathic Medicine": ["NYITCOM"],
    "Michigan State University College of Osteopathic Medicine": ["MSUCOM"],
    "A.T. Still University of Health Sciences Kirksville College of Osteopathic Medicine": [
        "ATSU-KCOM",
        "Kirksville College of Osteopathic Medicine",
        "KCOM",
    ],
    "A.T. Still University School of Osteopathic Medicine": [
        "ATSU-SOMA",
        "AT Still SOMA",
        "School of Osteopathic Medicine in Arizona",
    ],
    "St. George's University School of Medicine": [
        "SGU",
        "St Georges University",
        "Saint George's University School of Medicine",
    ],
    "Ross University School of Medicine": ["RUSM", "Ross Med"],
    "American University of the Caribbean School of Medicine": ["AUC School of Medicine"],
    "University of Toronto Temerty Faculty of Medicine": [
        "U of T Medicine",
        "University of Toronto Faculty of Medicine",
        "Temerty Medicine",
    ],
    "McGill University Faculty of Medicine and Health Sciences": ["McGill Medicine"],
    "NOSM University": ["Northern Ontario School of Medicine", "NOSM"],
    "Yale Physician Associate Program": [
        "Yale PA",
        "Yale Physician Assistant Program",
        "Yale PA Program",
    ],
    "Yale School of Nursing": ["YSN", "Yale Nursing"],
}

EMAIL_DOMAINS = {
    "University of California, San Francisco School of Medicine": ["ucsf.edu"],
    "David Geffen School of Medicine at UCLA": ["mednet.ucla.edu", "ucla.edu"],
    "University of California, San Diego School of Medicine": ["ucsd.edu", "health.ucsd.edu"],
    "University of California, Davis School of Medicine": ["ucdavis.edu"],
    "University of California, Irvine School of Medicine": ["uci.edu"],
    "University of California, Riverside School of Medicine": ["ucr.edu"],
    "Yale School of Medicine": ["yale.edu"],
    "Yale Physician Associate Program": ["yale.edu"],
    "Yale School of Nursing": ["yale.edu"],
    "Yale School of Public Health": ["yale.edu"],
    "Harvard Medical School": ["hms.harvard.edu", "harvard.edu"],
    "Stanford University School of Medicine": ["stanford.edu"],
    "Johns Hopkins University School of Medicine": ["jhmi.edu", "jhu.edu"],
    "Columbia University Vagelos College of Physicians and Surgeons": ["cumc.columbia.edu", "columbia.edu"],
    "Weill Cornell Medical College": ["med.cornell.edu", "cornell.edu"],
    "NYU Grossman School of Medicine": ["nyulangone.org", "nyu.edu"],
    "Icahn School of Medicine at Mount Sinai": ["mssm.edu", "mountsinai.org"],
    "Albert Einstein College of Medicine": ["einsteinmed.edu"],
    "Perelman School of Medicine at the University of Pennsylvania": ["pennmedicine.upenn.edu", "upenn.edu"],
    "Duke University School of Medicine": ["duke.edu"],
    "Vanderbilt University School of Medicine": ["vanderbilt.edu", "vumc.org"],
    "Emory University School of Medicine": ["emory.edu"],
    "Northwestern University Feinberg School of Medicine": ["northwestern.edu", "nm.org"],
    "University of Chicago Division of the Biological Sciences The Pritzker School of Medicine": ["uchicago.edu"],
    "University of Michigan Medical School": ["umich.edu", "med.umich.edu"],
    "Washington University in St. Louis School of Medicine": ["wustl.edu"],
    "Mayo Clinic Alix School of Medicine": ["mayo.edu"],
    "Baylor College of Medicine School of Medicine": ["bcm.edu"],
    "University of Texas Southwestern Medical School": ["utsouthwestern.edu"],
    "McGovern Medical School at UTHealth Houston": ["uth.tmc.edu"],
    "University of Washington School of Medicine": ["uw.edu", "washington.edu"],
    "Oregon Health & Science University School of Medicine": ["ohsu.edu"],
    "University of Colorado School of Medicine": ["cuanschutz.edu", "ucdenver.edu"],
    "Keck School of Medicine of University of Southern California": ["usc.edu"],
    "Loma Linda University School of Medicine": ["llu.edu"],
    "Kaiser Permanente Bernard J. Tyson School of Medicine": ["kp.org"],
    "Boston University Aram V. Chobanian & Edward Avedisian School of Medicine": ["bu.edu"],
    "Tufts University School of Medicine": ["tufts.edu"],
    "University of Massachusetts T.H. Chan School of Medicine": ["umassmed.edu"],
    "Geisel School of Medicine at Dartmouth": ["dartmouth.edu", "hitchcock.org"],
    "The Warren Alpert Medical School at Brown University": ["brown.edu"],
    "University of North Carolina School of Medicine": ["unc.edu", "med.unc.edu"],
    "Wake Forest School of Medicine": ["wakehealth.edu"],
    "University of Pittsburgh School of Medicine": ["pitt.edu"],
    "Case Western Reserve University School of Medicine": ["case.edu"],
    "The Ohio State University College of Medicine": ["osu.edu", "osumc.edu"],
    "University of Wisconsin School of Medicine and Public Health": ["wisc.edu"],
    "University of Minnesota Medical School": ["umn.edu"],
    "University of Iowa Roy J. and Lucille A. Carver College of Medicine": ["uiowa.edu"],
    "University of Alabama at Birmingham Marnix E. Heersink School of Medicine": ["uab.edu"],
    "University of Florida College of Medicine": ["ufl.edu"],
    "University of Miami Leonard M. Miller School of Medicine": ["miami.edu", "med.miami.edu"],
    "USF Health Morsani College of Medicine": ["usf.edu"],
    "University of Virginia School of Medicine": ["virginia.edu"],
    "Virginia Commonwealth University School of Medicine": ["vcu.edu"],
    "Georgetown University School of Medicine": ["georgetown.edu"],
    "George Washington University School of Medicine and Health Sciences": ["gwu.edu"],
    "Howard University College of Medicine": ["howard.edu"],
    "Meharry Medical College School of Medicine": ["mmc.edu"],
    "Morehouse School of Medicine": ["msm.edu"],
    "Tulane University School of Medicine": ["tulane.edu"],
    "Louisiana State University School of Medicine in New Orleans": ["lsuhsc.edu"],
    "University of Utah Spencer Fox Eccles School of Medicine": ["utah.edu"],
    "Spencer Fox Eccles School of Medicine at the University of Utah": ["utah.edu"],
    "University of Arizona College of Medicine – Tucson": ["arizona.edu"],
    "The University of Arizona College of Medicine Phoenix": ["arizona.edu"],
    "University of New Mexico School of Medicine": ["unm.edu", "salud.unm.edu"],
    "University of Toronto Temerty Faculty of Medicine": ["utoronto.ca"],
    "McGill University Faculty of Medicine and Health Sciences": ["mcgill.ca"],
    "University of British Columbia Faculty of Medicine": ["ubc.ca"],
    "McMaster University Michael G. DeGroote School of Medicine": ["mcmaster.ca"],
    "St. George's University School of Medicine": ["sgu.edu"],
    "Ross University School of Medicine": ["rossu.edu"],
    "American University of the Caribbean School of Medicine": ["aucmed.edu"],
}


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_text_array(values: list[str]) -> str:
    if not values:
        return "'{}'::text[]"
    inner = ",".join(sql_str(v) for v in values)
    return f"ARRAY[{inner}]::text[]"


def strip_suffix(name: str) -> str:
    out = name
    for suf in SUFFIXES:
        if out.endswith(suf):
            out = out[: -len(suf)].strip(" ,")
            break
    return out


def _is_useful_alias(alias: str, canonical: str) -> bool:
    a = alias.strip()
    if not a or a == canonical:
        return False
    # Single generic tokens ("Alabama", "Yale" is allowed only via SHORT_NAMES/EXTRA)
    if " " not in a and len(a) < 5:
        return False
    if a.lower() in {"college", "university", "school", "medicine", "medical"}:
        return False
    return True


def auto_aliases(name: str, short: str | None) -> list[str]:
    aliases: set[str] = set()
    if short:
        aliases.add(short)
    aliases.add(name.replace(",", ""))
    stripped = strip_suffix(name)
    if stripped and stripped != name and (len(stripped) >= 12 or "University" in stripped or "College" in stripped):
        aliases.add(stripped)
    if name.startswith("The "):
        aliases.add(name[4:])
    return sorted(a for a in aliases if a == short or _is_useful_alias(a, name))


def short_for(name: str) -> str | None:
    return SHORT_NAMES.get(name)


def main() -> None:
    rows = json.loads(SRC.read_text())
    prepared = []
    for r in rows:
        name = r["canonical_name"]
        short = short_for(name)
        aliases = set(auto_aliases(name, short))
        aliases.update(EXTRA_ALIASES.get(name, []))
        aliases.discard(name)
        aliases = sorted(aliases, key=lambda s: (len(s), s.lower()))
        domains = EMAIL_DOMAINS.get(name, [])
        # Prefer MD for yale.edu collisions by putting allied domains only when
        # the query/email matcher ranks MD first (handled in SQL).
        prepared.append(
            {
                **r,
                "short_name": short,
                "aliases": aliases,
                "email_domains": domains,
            }
        )

    prepared.sort(key=lambda r: (r["canonical_name"].lower()))

    values_sql = []
    for r in prepared:
        values_sql.append(
            "  ("
            + ", ".join(
                [
                    sql_str(r["canonical_name"]),
                    sql_str(r["short_name"]) if r["short_name"] else "NULL",
                    sql_str(r["kind"]),
                    sql_str(r["country"]),
                    sql_str(r["region"]) if r.get("region") else "NULL",
                    sql_text_array(r["aliases"]),
                    sql_text_array(r["email_domains"]),
                ]
            )
            + ")"
        )

    header = f"""-- 027: Canonical medical schools / programs
-- Run in Supabase Dashboard → SQL Editor, then 028_institution_scope.sql, then 029_content_tenancy.sql.
-- Source: US LCME MD + COCA DO (2026 lists), Canadian faculties of medicine,
-- major Caribbean IMGs, and Yale allied programs. {len(prepared)} rows.
-- Re-runnable: ON CONFLICT (canonical_name) updates aliases/domains.

CREATE TABLE IF NOT EXISTS public.institutions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  text NOT NULL UNIQUE,
  short_name      text,
  kind            text NOT NULL CHECK (kind IN ('md', 'do', 'canada_md', 'caribbean', 'allied')),
  country         text NOT NULL DEFAULT 'US',
  region          text,
  aliases         text[] NOT NULL DEFAULT '{{}}',
  email_domains   text[] NOT NULL DEFAULT '{{}}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutions_short_name
  ON public.institutions (lower(short_name));

CREATE INDEX IF NOT EXISTS idx_institutions_aliases
  ON public.institutions USING gin (aliases);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions are publicly readable" ON public.institutions;
CREATE POLICY "institutions are publicly readable"
  ON public.institutions FOR SELECT
  USING (true);

GRANT SELECT ON public.institutions TO anon, authenticated;

INSERT INTO public.institutions
  (canonical_name, short_name, kind, country, region, aliases, email_domains)
VALUES
"""

    footer = """
ON CONFLICT (canonical_name) DO UPDATE SET
  short_name    = EXCLUDED.short_name,
  kind          = EXCLUDED.kind,
  country       = EXCLUDED.country,
  region        = EXCLUDED.region,
  aliases       = EXCLUDED.aliases,
  email_domains = EXCLUDED.email_domains;
"""

    OUT.write_text(header + ",\n".join(values_sql) + footer)
    print(f"Wrote {len(prepared)} institutions to {OUT}")


if __name__ == "__main__":
    main()

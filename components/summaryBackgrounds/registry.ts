import { memo, type ComponentType } from "react";
import { DEFAULT_BACKGROUND_INDEX, SUMMARY_BACKGROUND_COUNT } from "../../lib/backgroundRotation";
import { coverScene } from "./coverImage";

// The one list of Summary backgrounds - the pictures in
// assets/habbit-summary-backgrounds-27, all 1024x1024. The position in this list
// is what the rotation stores, so NEW ONES GO AT THE END and existing ones are
// never reordered or removed (that would silently change what a saved index means).
export interface SummaryBackgroundEntry {
  id: string;
  name: string;
  source: number; // the require()d picture, also used for the chooser's thumbnails
  Scene: ComponentType;
  // Alpha (0-1) of the dark layer between the picture and the card's text; omit
  // for the default.
  overlay?: number;
}

function background<const Id extends string>(id: Id, name: string, source: number, overlay?: number) {
  return { id, name, source, Scene: memo(coverScene(source)), overlay } as const;
}

export const SUMMARY_BACKGROUNDS = [
  background("pink-himalayas", "Pink Himalayas", require("../../assets/habbit-summary-backgrounds-27/1-pink_himalayas.png")),
  background("aurora-lake", "Aurora Lake", require("../../assets/habbit-summary-backgrounds-27/2-aurora_lake.png")),
  background("ocean-sunset", "Ocean Sunset", require("../../assets/habbit-summary-backgrounds-27/3-ocean_sunset.png")),
  background("misty-valley", "Misty Valley", require("../../assets/habbit-summary-backgrounds-27/4-misty_valley.png")),
  background("tropical-leaves", "Tropical Leaves", require("../../assets/habbit-summary-backgrounds-27/5-tropical_leaves.png")),
  background("waterfall", "Waterfall", require("../../assets/habbit-summary-backgrounds-27/6-waterfall.png")),
  background("cherry-blossoms", "Cherry Blossoms", require("../../assets/habbit-summary-backgrounds-27/7-cherry_blossoms.png")),
  background("desert-dunes", "Desert Dunes", require("../../assets/habbit-summary-backgrounds-27/8-desert_dunes.png")),
  background("starry-night", "Starry Night", require("../../assets/habbit-summary-backgrounds-27/9-starry_night.png")),
  background("sunrise-meadow", "Sunrise Meadow", require("../../assets/habbit-summary-backgrounds-27/10-sunrise_meadow.png")),
  background("river-valley", "River Valley", require("../../assets/habbit-summary-backgrounds-27/11-river_valley.png")),
  background("lotus-pond", "Lotus Pond", require("../../assets/habbit-summary-backgrounds-27/12-lotus_pond.png")),
  background("firefly-forest", "Firefly Forest", require("../../assets/habbit-summary-backgrounds-27/13-firefly_forest.png")),
  background("organic-flow", "Organic Flow", require("../../assets/habbit-summary-backgrounds-27/14-organic_flow.png")),
  background("cloud-garden", "Cloud Garden", require("../../assets/habbit-summary-backgrounds-27/15-cloud_garden.png")),
  background("tokyo", "Tokyo", require("../../assets/habbit-summary-backgrounds-27/16-tokyo.png")),
  background("paris", "Paris", require("../../assets/habbit-summary-backgrounds-27/17-paris.png")),
  background("new-york", "New York", require("../../assets/habbit-summary-backgrounds-27/18-new_york.png")),
  background("london", "London", require("../../assets/habbit-summary-backgrounds-27/19-london.png")),
  background("dubai", "Dubai", require("../../assets/habbit-summary-backgrounds-27/20-dubai.png")),
  background("singapore", "Singapore", require("../../assets/habbit-summary-backgrounds-27/21-singapore.png")),
  background("shanghai", "Shanghai", require("../../assets/habbit-summary-backgrounds-27/22-shanghai.png")),
  background("rome", "Rome", require("../../assets/habbit-summary-backgrounds-27/23-rome.png")),
  background("istanbul", "Istanbul", require("../../assets/habbit-summary-backgrounds-27/24-istanbul.png")),
  background("sydney", "Sydney", require("../../assets/habbit-summary-backgrounds-27/25-sydney.png")),
  background("pokhara-nepal", "Pokhara, Nepal", require("../../assets/habbit-summary-backgrounds-27/26-pokhara_nepal.png")),
  background("janaki-mandir-janakpur", "Janaki Mandir, Janakpur", require("../../assets/habbit-summary-backgrounds-27/27-janaki_mandir_janakpur.png")),
] as const satisfies readonly SummaryBackgroundEntry[];

// These fail the type check if the list and lib/backgroundRotation.ts disagree:
// on how many backgrounds exist (the rotation picks indexes from that count) or on
// which one is the default (Pokhara).
type RegistrySizeMatchesRotation = (typeof SUMMARY_BACKGROUNDS)["length"] extends typeof SUMMARY_BACKGROUND_COUNT
  ? typeof SUMMARY_BACKGROUND_COUNT extends (typeof SUMMARY_BACKGROUNDS)["length"]
    ? true
    : never
  : never;
export const REGISTRY_SIZE_OK: RegistrySizeMatchesRotation = true;

type DefaultIsPokhara = (typeof SUMMARY_BACKGROUNDS)[typeof DEFAULT_BACKGROUND_INDEX]["id"] extends "pokhara-nepal" ? true : never;
export const DEFAULT_IS_POKHARA: DefaultIsPokhara = true;

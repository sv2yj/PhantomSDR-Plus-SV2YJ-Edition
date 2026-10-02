#include "software_info.h"

namespace listing {

namespace {

std::string non_empty_or(const std::string &value, const std::string &fallback) {
    return value.empty() ? fallback : value;
}

}  // namespace

SoftwareInfo resolve_software_info(const toml::table &cfg) {
    SoftwareInfo out;

    // New dedicated section (preferred):
    // [listing.software]
    // name = "PhantomSDR+"
    // version = "3.4.0"
    if (const auto *listing_tbl = cfg["listing"].as_table()) {
        if (const auto *soft_tbl = (*listing_tbl)["software"].as_table()) {
            out.name = (*soft_tbl)["name"].value_or(std::string{});
            out.version = (*soft_tbl)["version"].value_or(std::string{});
        }
    }

    // Backward-compatible fallback under [websdr]
    if (const auto *websdr_tbl = cfg["websdr"].as_table()) {
        if (out.name.empty()) {
            out.name = (*websdr_tbl)["software_name"].value_or(std::string{});
        }
        if (out.version.empty()) {
            out.version = (*websdr_tbl)["software_version"].value_or(std::string{});
        }
    }

    // Safe defaults (final fallback)
    out.name = non_empty_or(out.name, "PhantomSDR+");
    out.version = non_empty_or(out.version, "v.4.2.0");
    return out;
}

}  // namespace listing

#ifndef LISTING_SOFTWARE_INFO_H
#define LISTING_SOFTWARE_INFO_H

#include <string>
#include <toml++/toml.h>

namespace listing {

struct SoftwareInfo {
    std::string name;
    std::string version;
};

// Resolve software name/version for SDR-list payloads.
// Priority (to be used by caller):
// 1) [listing.software] name/version
// 2) [websdr]          software_name/software_version
// 3) hardcoded defaults in implementation
SoftwareInfo resolve_software_info(const toml::table &cfg);

}  // namespace listing

#endif  // LISTING_SOFTWARE_INFO_H

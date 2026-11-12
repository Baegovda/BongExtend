import assert from "node:assert/strict";
import test from "node:test";
import {darkSiteEnabled} from "../settings.js";

test("the most specific on/off rule wins", () => {
    const base = {enabledByDefault: false, enabledSites: [], disabledSites: [], siteListMode: "exclude", siteList: []};
    assert.equal(darkSiteEnabled({...base, enabledSites: ["mail.google.com"], disabledSites: ["google.com"]}, "mail.google.com"), true, "a specific on rule beats a parent off rule");
    assert.equal(darkSiteEnabled({...base, enabledSites: ["google.com"], disabledSites: ["mail.google.com"]}, "mail.google.com"), false, "a specific off rule beats a parent on rule");
    assert.equal(darkSiteEnabled({...base, enabledSites: ["google.com"], disabledSites: ["google.com"]}, "google.com"), false, "the same rule on both lists stays off");
    assert.equal(darkSiteEnabled({...base, disabledSites: ["google.com"]}, "www.google.com"), false);
    assert.equal(darkSiteEnabled({...base, enabledSites: ["google.com"]}, "docs.google.com"), true, "subdomains follow the parent");
    assert.equal(darkSiteEnabled({...base, enabledSites: ["google.com"], disabledSites: ["mail.google.com"]}, "docs.google.com"), true);
});

test("defaults and site lists still apply when no rule matches", () => {
    assert.equal(darkSiteEnabled({enabledByDefault: true, enabledSites: [], disabledSites: [], siteListMode: "exclude", siteList: []}, "example.com"), true);
    assert.equal(darkSiteEnabled({enabledByDefault: true, enabledSites: [], disabledSites: [], siteListMode: "exclude", siteList: ["example.com"]}, "a.example.com"), false);
    assert.equal(darkSiteEnabled({enabledByDefault: false, enabledSites: [], disabledSites: [], siteListMode: "only", siteList: ["example.com"]}, "example.com"), false);
    assert.equal(darkSiteEnabled({enabledByDefault: false, enabledSites: [], disabledSites: [], siteListMode: "exclude", siteList: []}, ""), false);
});

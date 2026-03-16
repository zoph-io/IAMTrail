"use client";

import { useState, useEffect, useMemo } from "react";

interface KnownAccount {
  name: string;
  source?: string[];
  type?: string;
  accounts: string[];
  enabled?: boolean;
}

interface SearchResult {
  name: string;
  type?: string;
  accountId: string;
  sources: string[];
}

export default function AccountsPage() {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<KnownAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/known-accounts.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load accounts data");
        return res.json();
      })
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) return [];

    const matches: SearchResult[] = [];
    for (const entry of accounts) {
      for (const accountId of entry.accounts) {
        if (accountId.includes(trimmed)) {
          matches.push({
            name: entry.name,
            type: entry.type,
            accountId,
            sources: entry.source || [],
          });
        }
      }
    }
    return matches;
  }, [query, accounts]);

  const totalAccounts = useMemo(() => {
    return accounts.reduce((sum, entry) => sum + entry.accounts.length, 0);
  }, [accounts]);

  const searched = query.trim().length >= 3;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
          AWS Account Lookup
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
          Found an unknown account ID in your CloudTrail logs, S3 bucket
          policies, or IAM trust relationships? Paste it here to identify the
          owner.
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <label htmlFor="account-search" className="sr-only">
          AWS Account ID
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-zinc-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            id="account-search"
            type="text"
            inputMode="numeric"
            placeholder="Paste an AWS Account ID (e.g. 464622532012)"
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full pl-12 pr-4 py-3 text-base font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            maxLength={12}
            autoFocus
          />
        </div>
        {!loading && (
          <p className="mt-3 text-xs font-mono text-zinc-400 dark:text-zinc-500 text-center">
            {accounts.length} vendors / {totalAccounts.toLocaleString()}{" "}
            known account IDs indexed
          </p>
        )}
      </div>

      {/* Privacy & Security Notice */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          <div>
            <h3 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1.5">
              100% client-side search
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">
              The entire accounts database is loaded into your browser. Your search queries never leave your device and no account IDs are sent to any server.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Note: as per{" "}
              <a
                href="https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-identifiers.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                AWS documentation
              </a>
              , account IDs &quot;are not considered secret, sensitive, or confidential information.&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-300 border-t-red-600 rounded-full"></div>
          <p className="mt-4 text-zinc-500 dark:text-zinc-400 text-sm font-mono">
            Loading accounts database...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-5 text-center">
          <p className="text-red-700 dark:text-red-300 text-sm">
            Failed to load accounts data. Try refreshing the page.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && searched && (
        <div className="space-y-3">
          {results.length > 0 ? (
            <>
              <p className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">
                {results.length} match{results.length !== 1 ? "es" : ""} found
              </p>
              <div className="space-y-3">
                {results.map((result, idx) => (
                  <div
                    key={`${result.accountId}-${idx}`}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:border-red-300 dark:hover:border-red-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                          {result.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <code className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-sm font-mono font-medium border border-red-200 dark:border-red-800">
                            {result.accountId}
                          </code>
                          {result.type && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {result.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {result.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-widest">
                          Documentation
                        </p>
                        <div className="space-y-1">
                          {result.sources.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline truncate"
                            >
                              {source}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
              <h3 className="text-base font-semibold font-mono text-zinc-900 dark:text-white mb-2">
                No match found
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Account ID <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">{query}</code>{" "}
                was not found in the known accounts database.
              </p>
              <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-4">
                Know who owns this account? Help the community by opening a PR.
              </p>
              <a
                href="https://github.com/fwdcloudsec/known_aws_accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono font-medium rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Submit a Pull Request
              </a>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !searched && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Enter at least 3 digits of an AWS account ID above to search.
          </p>
        </div>
      )}

      {/* AWS Trustline */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
              AWS Trustline
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Map and audit third-party trust relationships in your AWS account.
              Trustline analyzes IAM role trust policies and S3 bucket policies,
              then cross-references account IDs against this known accounts
              dataset to identify vendors automatically.
            </p>
          </div>
          <a
            href="https://github.com/zoph-io/aws-trustline"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono font-medium rounded transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>

      {/* Contribute CTA */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
              Know a vendor AWS account ID?
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              This is a community-driven dataset. If you know an AWS account ID
              belonging to an AWS service or third-party vendor, contribute it
              by opening a pull request.
            </p>
          </div>
          <a
            href="https://github.com/fwdcloudsec/known_aws_accounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono font-medium rounded transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Contribute on GitHub
          </a>
        </div>
      </div>

      {/* Data Attribution */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <div className="flex items-center gap-4">
          <a
            href="https://fwdcloudsec.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <img
              src="https://fwdcloudsec.org/assets/img/logo.svg"
              alt="fwd:cloudsec"
              className="h-8 w-auto dark:invert"
            />
          </a>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Powered by the{" "}
            <a
              href="https://github.com/fwdcloudsec/known_aws_accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              fwdcloudsec/known_aws_accounts
            </a>{" "}
            community dataset, maintained by the{" "}
            <a
              href="https://fwdcloudsec.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              fwd:cloudsec
            </a>{" "}
            cloud security community.
          </p>
        </div>
      </div>
    </div>
  );
}

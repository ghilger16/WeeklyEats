import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
    private let pendingImportsKey = "pendingRecipeImports"
    private var didHandleShare = false
    private var debugLabel: UILabel?
    private var finishTimer: Timer?
    private var closeButton: UIButton?
    private var saveButton: UIButton?
    private var pendingUrl: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        setupDebugLabel()
        setupSaveButton()
        setupCloseButton()
        updateDebug("Share extension loaded...")
        triggerHandleIfNeeded()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        triggerHandleIfNeeded()
    }

    private func triggerHandleIfNeeded() {
        guard !didHandleShare else { return }
        didHandleShare = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.handleSharedItem()
        }
    }

    private func handleSharedItem() {
        let urlType = UTType.url.identifier
        let textType = UTType.text.identifier

        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let providers = items.compactMap { $0.attachments }.flatMap { $0 }
        updateDebug(
            "items=\(items.count) providers=\(providers.count)\n" +
            providers.map { $0.registeredTypeIdentifiers.joined(separator: ",") }
                .joined(separator: "\n")
        )
        guard !providers.isEmpty else {
            updateDebug("No providers found.")
            scheduleFinish()
            return
        }

        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(urlType) }) {
            provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] item, _ in
                DispatchQueue.main.async {
                    self?.handleLoadedItem(item)
                }
            }
            return
        }

        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(textType) }) {
            provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] item, _ in
                DispatchQueue.main.async {
                    self?.handleLoadedItem(item)
                }
            }
            return
        }

        scheduleFinish()
    }

    private func handleLoadedItem(_ item: NSSecureCoding?) {
        if let url = item as? URL {
            updateDebug("Loaded URL: \(url.absoluteString)")
            pendingUrl = url
            saveButton?.isEnabled = true
            updateDebug("Ready to save:\n\(url.absoluteString)")
            return
        }

        if let text = item as? String {
            updateDebug("Loaded text: \(text)")
            if let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)) {
                pendingUrl = url
                saveButton?.isEnabled = true
                updateDebug("Ready to save:\n\(url.absoluteString)")
                return
            }
        }

        if let data = item as? Data, let text = String(data: data, encoding: .utf8) {
            updateDebug("Loaded data: \(text)")
            if let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)) {
                pendingUrl = url
                saveButton?.isEnabled = true
                updateDebug("Ready to save:\n\(url.absoluteString)")
                return
            }
        }

        updateDebug("No URL parsed from item.")
        scheduleFinish()
    }

    private func saveRecipe(_ url: URL) {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            updateDebug("Could not save. App Group is unavailable.")
            saveButton?.isEnabled = true
            return
        }

        let importItem: [String: Any] = [
            "id": UUID().uuidString,
            "recipeUrl": url.absoluteString,
            "sharedAt": ISO8601DateFormatter().string(from: Date()),
            "source": "shareExtension",
        ]

        var imports = defaults.array(forKey: pendingImportsKey) as? [[String: Any]] ?? []
        imports.append(importItem)
        defaults.set(imports, forKey: pendingImportsKey)
        defaults.synchronize()

        updateDebug("Saved to WeeklyEats.\nOpen WeeklyEats to review this recipe.")
        saveButton?.isEnabled = false
        finishAfterSave()
    }

    private func finish() {
        finishTimer?.invalidate()
        finishTimer = nil
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func finishAfterSave() {
        finishTimer?.invalidate()
        finishTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: false) { [weak self] _ in
            self?.finish()
        }
    }

    private func scheduleFinish() {
        finishTimer?.invalidate()
        finishTimer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: false) { [weak self] _ in
            self?.finish()
        }
    }

    private func setupDebugLabel() {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.numberOfLines = 0
        label.textColor = .label
        label.font = UIFont.systemFont(ofSize: 12)
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            label.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
        ])
        debugLabel = label
    }

    private func setupCloseButton() {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Close", for: .normal)
        button.addTarget(self, action: #selector(handleCloseTap), for: .touchUpInside)
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            button.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
        closeButton = button
    }

    private func setupSaveButton() {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Save Recipe", for: .normal)
        button.isEnabled = false
        button.addTarget(self, action: #selector(handleSaveTap), for: .touchUpInside)
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            button.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -56),
        ])
        saveButton = button
    }

    @objc private func handleCloseTap() {
        finish()
    }

    @objc private func handleSaveTap() {
        guard let url = pendingUrl else {
            updateDebug("No URL to save yet.")
            return
        }
        saveButton?.isEnabled = false
        saveRecipe(url)
    }

    private func updateDebug(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.debugLabel?.text = text
        }
    }
}

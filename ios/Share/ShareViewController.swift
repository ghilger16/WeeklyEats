import UIKit
import LinkPresentation
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
    private let pendingImportsKey = "pendingRecipeImports"
    private let accentColor = UIColor(red: 0.83, green: 0.08, blue: 0.38, alpha: 1)
    private let paleCardColor = UIColor(red: 1.0, green: 0.97, blue: 0.98, alpha: 1)
    private let softTextColor = UIColor(red: 0.42, green: 0.40, blue: 0.43, alpha: 1)

    private var didHandleShare = false
    private var finishTimer: Timer?
    private var metadataProvider: LPMetadataProvider?
    private var pendingUrl: URL?
    private var pageTitle: String?
    private var imageUrl: String?

    private let titleLabel = UILabel()
    private let domainLabel = UILabel()
    private let urlValueLabel = UILabel()
    private let previewImageContainer = UIView()
    private let previewPhotoImageView = UIImageView()
    private let previewImageIcon = UIImageView()
    private let planSwitch = UISwitch()
    private let saveButton = UIButton(type: .system)
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = UIColor.black.withAlphaComponent(0.22)
        setupInterface()
        updateRecipeContent()
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

    private func setupInterface() {
        let sheetView = UIView()
        sheetView.translatesAutoresizingMaskIntoConstraints = false
        sheetView.backgroundColor = UIColor(red: 1, green: 0.985, blue: 0.99, alpha: 1)
        sheetView.layer.cornerRadius = 28
        sheetView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        sheetView.layer.shadowColor = UIColor.black.cgColor
        sheetView.layer.shadowOpacity = 0.14
        sheetView.layer.shadowRadius = 26
        sheetView.layer.shadowOffset = CGSize(width: 0, height: -8)
        view.addSubview(sheetView)

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = false
        scrollView.showsVerticalScrollIndicator = false
        sheetView.addSubview(scrollView)

        let contentView = UIView()
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)

        let dragHandle = UIView()
        dragHandle.translatesAutoresizingMaskIntoConstraints = false
        dragHandle.backgroundColor = UIColor(red: 0.82, green: 0.80, blue: 0.82, alpha: 1)
        dragHandle.layer.cornerRadius = 3
        contentView.addSubview(dragHandle)

        let headerIcon = makeIconTile()
        contentView.addSubview(headerIcon)

        let headerTitle = UILabel()
        headerTitle.translatesAutoresizingMaskIntoConstraints = false
        headerTitle.text = "Save to Weekly Eats"
        headerTitle.textColor = .black
        headerTitle.font = .systemFont(ofSize: 24, weight: .bold)
        headerTitle.adjustsFontSizeToFitWidth = true
        headerTitle.minimumScaleFactor = 0.82
        contentView.addSubview(headerTitle)

        let subtitle = UILabel()
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        subtitle.text = "Add this recipe to your collection."
        subtitle.textColor = softTextColor
        subtitle.font = .systemFont(ofSize: 17, weight: .regular)
        subtitle.adjustsFontSizeToFitWidth = true
        subtitle.minimumScaleFactor = 0.85
        contentView.addSubview(subtitle)

        let previewCard = makePreviewCard()
        contentView.addSubview(previewCard)

        let planRow = makePlanForLaterRow()
        contentView.addSubview(planRow)

        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.backgroundColor = accentColor
        saveButton.tintColor = .white
        saveButton.layer.cornerRadius = 31
        saveButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        saveButton.setTitle("  Save Recipe", for: .normal)
        saveButton.setImage(UIImage(systemName: "bookmark"), for: .normal)
        saveButton.imageView?.contentMode = .scaleAspectFit
        saveButton.isEnabled = false
        saveButton.alpha = 0.55
        saveButton.addTarget(self, action: #selector(handleSaveTap), for: .touchUpInside)
        contentView.addSubview(saveButton)

        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.backgroundColor = UIColor.white.withAlphaComponent(0.52)
        closeButton.tintColor = accentColor
        closeButton.layer.cornerRadius = 28
        closeButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        closeButton.setTitle("Close", for: .normal)
        closeButton.addTarget(self, action: #selector(handleCloseTap), for: .touchUpInside)
        contentView.addSubview(closeButton)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textColor = accentColor
        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 2
        contentView.addSubview(statusLabel)

        let tipRow = makeTipRow()
        contentView.addSubview(tipRow)

        NSLayoutConstraint.activate([
            sheetView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sheetView.topAnchor.constraint(equalTo: view.topAnchor),

            scrollView.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: sheetView.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: sheetView.safeAreaLayoutGuide.bottomAnchor),

            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            dragHandle.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            dragHandle.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            dragHandle.widthAnchor.constraint(equalToConstant: 54),
            dragHandle.heightAnchor.constraint(equalToConstant: 6),

            headerIcon.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            headerIcon.topAnchor.constraint(equalTo: dragHandle.bottomAnchor, constant: 28),
            headerIcon.widthAnchor.constraint(equalToConstant: 76),
            headerIcon.heightAnchor.constraint(equalToConstant: 76),

            headerTitle.leadingAnchor.constraint(equalTo: headerIcon.trailingAnchor, constant: 18),
            headerTitle.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            headerTitle.topAnchor.constraint(equalTo: headerIcon.topAnchor, constant: 9),

            subtitle.leadingAnchor.constraint(equalTo: headerTitle.leadingAnchor),
            subtitle.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            subtitle.topAnchor.constraint(equalTo: headerTitle.bottomAnchor, constant: 8),

            previewCard.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            previewCard.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            previewCard.topAnchor.constraint(equalTo: headerIcon.bottomAnchor, constant: 34),
            previewCard.heightAnchor.constraint(equalToConstant: 150),

            planRow.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            planRow.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            planRow.topAnchor.constraint(equalTo: previewCard.bottomAnchor, constant: 38),

            saveButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            saveButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            saveButton.topAnchor.constraint(equalTo: planRow.bottomAnchor, constant: 40),
            saveButton.heightAnchor.constraint(equalToConstant: 62),

            closeButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            closeButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            closeButton.topAnchor.constraint(equalTo: saveButton.bottomAnchor, constant: 16),
            closeButton.heightAnchor.constraint(equalToConstant: 56),

            statusLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            statusLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),
            statusLabel.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 14),

            tipRow.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 34),
            tipRow.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -34),
            tipRow.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            tipRow.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -34),
        ])
    }

    private func makeIconTile() -> UIView {
        let tile = UIView()
        tile.translatesAutoresizingMaskIntoConstraints = false
        tile.backgroundColor = accentColor
        tile.layer.cornerRadius = 16

        let imageView = UIImageView(image: UIImage(systemName: "bookmark"))
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.tintColor = .white
        imageView.contentMode = .scaleAspectFit
        imageView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 34, weight: .semibold)
        tile.addSubview(imageView)

        NSLayoutConstraint.activate([
            imageView.centerXAnchor.constraint(equalTo: tile.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: tile.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 36),
            imageView.heightAnchor.constraint(equalToConstant: 36),
        ])

        return tile
    }

    private func makePreviewCard() -> UIView {
        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 24
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.08
        card.layer.shadowRadius = 18
        card.layer.shadowOffset = CGSize(width: 0, height: 8)

        previewImageContainer.translatesAutoresizingMaskIntoConstraints = false
        previewImageContainer.backgroundColor = paleCardColor
        previewImageContainer.layer.cornerRadius = 14
        previewImageContainer.clipsToBounds = true
        card.addSubview(previewImageContainer)

        previewPhotoImageView.translatesAutoresizingMaskIntoConstraints = false
        previewPhotoImageView.contentMode = .scaleAspectFill
        previewPhotoImageView.clipsToBounds = true
        previewPhotoImageView.alpha = 0
        previewImageContainer.addSubview(previewPhotoImageView)

        previewImageIcon.translatesAutoresizingMaskIntoConstraints = false
        previewImageIcon.image = UIImage(systemName: "fork.knife.circle.fill")
        previewImageIcon.tintColor = accentColor
        previewImageIcon.contentMode = .scaleAspectFit
        previewImageContainer.addSubview(previewImageIcon)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.textColor = .black
        titleLabel.font = .systemFont(ofSize: 19, weight: .semibold)
        titleLabel.numberOfLines = 2
        titleLabel.adjustsFontSizeToFitWidth = true
        titleLabel.minimumScaleFactor = 0.86
        card.addSubview(titleLabel)

        let globeIcon = UIImageView(image: UIImage(systemName: "globe"))
        globeIcon.translatesAutoresizingMaskIntoConstraints = false
        globeIcon.tintColor = softTextColor
        globeIcon.contentMode = .scaleAspectFit
        card.addSubview(globeIcon)

        domainLabel.translatesAutoresizingMaskIntoConstraints = false
        domainLabel.textColor = softTextColor
        domainLabel.font = .systemFont(ofSize: 15, weight: .regular)
        domainLabel.numberOfLines = 1
        domainLabel.lineBreakMode = .byTruncatingTail
        card.addSubview(domainLabel)

        NSLayoutConstraint.activate([
            previewImageContainer.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            previewImageContainer.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            previewImageContainer.widthAnchor.constraint(equalTo: card.widthAnchor, multiplier: 0.36),
            previewImageContainer.heightAnchor.constraint(equalToConstant: 110),

            previewPhotoImageView.leadingAnchor.constraint(equalTo: previewImageContainer.leadingAnchor),
            previewPhotoImageView.trailingAnchor.constraint(equalTo: previewImageContainer.trailingAnchor),
            previewPhotoImageView.topAnchor.constraint(equalTo: previewImageContainer.topAnchor),
            previewPhotoImageView.bottomAnchor.constraint(equalTo: previewImageContainer.bottomAnchor),

            previewImageIcon.centerXAnchor.constraint(equalTo: previewImageContainer.centerXAnchor),
            previewImageIcon.centerYAnchor.constraint(equalTo: previewImageContainer.centerYAnchor),
            previewImageIcon.widthAnchor.constraint(equalToConstant: 44),
            previewImageIcon.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.leadingAnchor.constraint(equalTo: previewImageContainer.trailingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 32),

            globeIcon.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            globeIcon.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            globeIcon.widthAnchor.constraint(equalToConstant: 18),
            globeIcon.heightAnchor.constraint(equalToConstant: 18),
            globeIcon.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -26),

            domainLabel.leadingAnchor.constraint(equalTo: globeIcon.trailingAnchor, constant: 10),
            domainLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            domainLabel.centerYAnchor.constraint(equalTo: globeIcon.centerYAnchor),
        ])

        return card
    }

    private func makeSectionHeader(iconName: String, title: String, trailingIcon: String) -> UIView {
        let row = UIView()
        row.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView(image: UIImage(systemName: iconName))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = accentColor
        icon.contentMode = .scaleAspectFit
        row.addSubview(icon)

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = title
        label.textColor = .black
        label.font = .systemFont(ofSize: 20, weight: .bold)
        row.addSubview(label)

        let chevron = UIImageView(image: UIImage(systemName: trailingIcon))
        chevron.translatesAutoresizingMaskIntoConstraints = false
        chevron.tintColor = accentColor
        chevron.contentMode = .scaleAspectFit
        row.addSubview(chevron)

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 4),
            icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 28),
            icon.heightAnchor.constraint(equalToConstant: 28),

            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 22),
            label.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            label.trailingAnchor.constraint(lessThanOrEqualTo: chevron.leadingAnchor, constant: -12),

            chevron.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -4),
            chevron.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 20),
            chevron.heightAnchor.constraint(equalToConstant: 20),
        ])

        return row
    }

    private func makePlanForLaterRow() -> UIView {
        let row = UIView()
        row.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView(image: UIImage(systemName: "calendar"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = accentColor
        icon.contentMode = .scaleAspectFit
        row.addSubview(icon)

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "Plan for Later?"
        title.textColor = .black
        title.font = .systemFont(ofSize: 20, weight: .bold)
        row.addSubview(title)

        let subtitle = UILabel()
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        subtitle.text = "Add this recipe to your next week ideas."
        subtitle.textColor = softTextColor
        subtitle.font = .systemFont(ofSize: 16, weight: .regular)
        subtitle.numberOfLines = 2
        row.addSubview(subtitle)

        planSwitch.translatesAutoresizingMaskIntoConstraints = false
        planSwitch.onTintColor = accentColor
        planSwitch.isOn = true
        row.addSubview(planSwitch)

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 4),
            icon.topAnchor.constraint(equalTo: row.topAnchor, constant: 6),
            icon.widthAnchor.constraint(equalToConstant: 30),
            icon.heightAnchor.constraint(equalToConstant: 30),

            title.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 22),
            title.trailingAnchor.constraint(lessThanOrEqualTo: planSwitch.leadingAnchor, constant: -14),
            title.topAnchor.constraint(equalTo: row.topAnchor),

            subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            subtitle.trailingAnchor.constraint(lessThanOrEqualTo: planSwitch.leadingAnchor, constant: -14),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            subtitle.bottomAnchor.constraint(equalTo: row.bottomAnchor),

            planSwitch.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -2),
            planSwitch.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])

        return row
    }

    private func makeTipRow() -> UIView {
        let row = UIView()
        row.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView(image: UIImage(systemName: "lightbulb"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = accentColor
        icon.contentMode = .scaleAspectFit
        row.addSubview(icon)

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = "Tip: You can find this recipe in Weekly Eats anytime."
        label.textColor = softTextColor
        label.font = .systemFont(ofSize: 14, weight: .regular)
        label.numberOfLines = 2
        row.addSubview(label)

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 26),
            icon.heightAnchor.constraint(equalToConstant: 26),

            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            label.topAnchor.constraint(equalTo: row.topAnchor),
            label.bottomAnchor.constraint(equalTo: row.bottomAnchor),
        ])

        return row
    }

    private func handleSharedItem() {
        let urlType = UTType.url.identifier
        let textType = UTType.text.identifier
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        pageTitle = items.compactMap { item in
            item.attributedTitle?.string.trimmingCharacters(in: .whitespacesAndNewlines)
        }.first { !$0.isEmpty }

        let providers = items.compactMap { $0.attachments }.flatMap { $0 }
        guard !providers.isEmpty else {
            statusLabel.text = "No recipe URL was shared."
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

        statusLabel.text = "No recipe URL was shared."
    }

    private func handleLoadedItem(_ item: NSSecureCoding?) {
        if let url = item as? URL {
            setPendingUrl(url)
            return
        }

        if let text = item as? String, let url = extractUrl(from: text) {
            setPendingUrl(url)
            return
        }

        if let data = item as? Data,
           let text = String(data: data, encoding: .utf8),
           let url = extractUrl(from: text) {
            setPendingUrl(url)
            return
        }

        statusLabel.text = "No recipe URL was found."
    }

    private func extractUrl(from text: String) -> URL? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true {
            return url
        }

        if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) {
            let range = NSRange(trimmed.startIndex..<trimmed.endIndex, in: trimmed)
            return detector.firstMatch(in: trimmed, options: [], range: range)?.url
        }

        return nil
    }

    private func setPendingUrl(_ url: URL) {
        pendingUrl = url
        saveButton.isEnabled = true
        saveButton.alpha = 1
        statusLabel.text = nil
        if pageTitle == nil || pageTitle?.isEmpty == true {
            pageTitle = readableTitle(from: url)
        }
        updateRecipeContent()
        loadMetadata(for: url)
    }

    private func updateRecipeContent() {
        guard let url = pendingUrl else {
            titleLabel.text = "Recipe link"
            domainLabel.text = "Waiting for shared URL"
            urlValueLabel.text = "Shared URL will appear here."
            return
        }

        titleLabel.text = pageTitle?.isEmpty == false ? pageTitle : url.absoluteString
        domainLabel.text = url.host ?? "Recipe source"
        urlValueLabel.text = url.absoluteString
    }

    private func loadMetadata(for url: URL) {
        metadataProvider?.cancel()
        let provider = LPMetadataProvider()
        metadataProvider = provider

        provider.startFetchingMetadata(for: url) { [weak self, weak provider] metadata, _ in
            guard let self, self.metadataProvider === provider, let metadata else {
                return
            }

            DispatchQueue.main.async {
                if let title = metadata.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
                    self.pageTitle = title
                    self.titleLabel.text = title
                }
            }

            let imageProvider = metadata.imageProvider ?? metadata.iconProvider
            imageProvider?.loadObject(ofClass: UIImage.self) { [weak self, weak provider] object, _ in
                guard
                    let self,
                    self.metadataProvider === provider,
                    let image = object as? UIImage
                else {
                    return
                }

                DispatchQueue.main.async {
                    self.previewPhotoImageView.image = image
                    UIView.animate(withDuration: 0.18) {
                        self.previewPhotoImageView.alpha = 1
                        self.previewImageIcon.alpha = 0
                    }
                }
            }
        }
    }

    private func readableTitle(from url: URL) -> String {
        let lastPath = url.deletingPathExtension().lastPathComponent
        let cleaned = lastPath
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if cleaned.isEmpty {
            return url.absoluteString
        }

        return cleaned
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    private func saveRecipe(_ url: URL) {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            statusLabel.text = "Could not save. App Group is unavailable."
            saveButton.isEnabled = true
            saveButton.alpha = 1
            return
        }

        let normalizedUrl = url.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = titleLabel.text?.trimmingCharacters(in: .whitespacesAndNewlines)
        let domain = url.host ?? ""
        let now = ISO8601DateFormatter().string(from: Date())
        let savedRecipe: [String: Any] = [
            "id": UUID().uuidString,
            "title": title?.isEmpty == false ? title! : normalizedUrl,
            "url": normalizedUrl,
            "recipeUrl": normalizedUrl,
            "domain": domain,
            "imageUrl": imageUrl ?? "",
            "createdAt": now,
            "sharedAt": now,
            "source": "share-extension",
            "planForLater": planSwitch.isOn,
        ]

        var imports = defaults.array(forKey: pendingImportsKey) as? [[String: Any]] ?? []
        imports.removeAll { item in
            let existingUrl = (item["url"] as? String) ?? (item["recipeUrl"] as? String)
            return existingUrl == normalizedUrl
        }
        imports.append(savedRecipe)
        defaults.set(imports, forKey: pendingImportsKey)
        defaults.synchronize()

        statusLabel.text = planSwitch.isOn
            ? "Saved for review. Plan for Later will apply when added."
            : "Saved for review in Weekly Eats."
        saveButton.isEnabled = false
        saveButton.alpha = 0.7
        finishAfterSave()
    }

    private func finish() {
        finishTimer?.invalidate()
        finishTimer = nil
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func finishAfterSave() {
        finishTimer?.invalidate()
        finishTimer = Timer.scheduledTimer(withTimeInterval: 1.1, repeats: false) { [weak self] _ in
            self?.finish()
        }
    }

    @objc private func handleCloseTap() {
        finish()
    }

    @objc private func handleSaveTap() {
        guard let url = pendingUrl else {
            statusLabel.text = "No URL to save yet."
            return
        }
        saveButton.isEnabled = false
        saveButton.alpha = 0.7
        saveRecipe(url)
    }
}

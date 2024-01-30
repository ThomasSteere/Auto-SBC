// ==UserScript==
// @name         FIFA AI SBC
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  automatically solve EAFC 24 SBCs using the currently available players in the club with the minimum cost
// @author       TitiroMonkey
// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @grant        GM_xmlhttpRequest
// @connect 	 www.futbin.com

// ==/UserScript==

(function () {
	'use strict';

	//turn on console log
	let i = document.createElement('iframe');
	i.style.display = 'none';
	document.body.appendChild(i);
	window.console = i.contentWindow.console;

	//Add Locked Icon
	let styles = `
    .player.locked::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #00ff00;
    z-index: 2;
}
   .ut-tab-bar-item.icon-sbcSettings:before {
      content: "\\E0B2";
   }
   .player.fixed::before {
    font-family: 'UltimateTeam-Icons';
    position: absolute;
    content: '\\E07F';
    right: 8px;
    bottom: 2px;
    color: #ff0000;
    z-index: 2;
}
   .item-price{
    width: auto !important;
    padding: 0 0.2rem;
    left: 50%;
    transform: translateX(-50%) !important;
    white-space: nowrap;
    background: #1e242a;
    border: 1px solid cornflowerblue;
    border-radius: 5px;
    position: absolute;
    z-index: 2;
    color: #fff;
    }
`;
	let styleSheet = document.createElement('style');
	styleSheet.innerText = styles;
	document.head.appendChild(styleSheet);

	const getElement = (query, parent = document) => {
		return getRootElement(parent).querySelector(query);
	};
	const css = (elem, css) => {
		for (let key of Object.keys(css)) {
			getRootElement(elem).style[key] = css[key];
		}
		return elem;
	};
	const addClass = (elem, ...className) => {
		getRootElement(elem).classList.add(...className);
		return elem;
	};
	const removeClass = (elem, className) => {
		getRootElement(elem).classList.remove(className);
		return elem;
	};
	const getElementString = (node) => {
		let DIV = document.createElement('div');
		if ('outerHTML' in DIV) {
			return node.outerHTML;
		}
		let div = DIV.cloneNode();
		div.appendChild(node.cloneNode(true));
		return div.innerHTML;
	};
	const createElem = (tag, attrs, innerHtml) => {
		let elem = document.createElement(tag);
		elem.innerHTML = innerHtml;
		if (attrs) {
			for (let attr of Object.keys(attrs)) {
				if (!attrs[attr]) continue;
				elem.setAttribute(attr === 'className' ? 'class' : attr, attrs[attr]);
			}
		}
		return elem;
	};
	const getRootElement = (elem) => {
		if (elem.getRootElement) {
			return elem.getRootElement();
		}
		return elem;
	};
	const insertBefore = (newNode, existingNode) => {
		existingNode = getRootElement(existingNode);
		existingNode.parentNode.insertBefore(getRootElement(newNode), existingNode);
		return newNode;
	};
	const insertAfter = (newNode, existingNode) => {
		existingNode = getRootElement(existingNode);
		existingNode.parentNode.insertBefore(
			getRootElement(newNode),
			existingNode.nextSibling
		);
		return newNode;
	};
	const createButton = (id, label, callback, buttonClass = 'btn-standard') => {
		const innerSpan = createElem(
			'span',
			{
				className: 'button__text',
			},
			label
		);
		const button = createElem(
			'button',
			{
				className: buttonClass,
				id: id,
			},
			getElementString(innerSpan)
		);
		button.addEventListener('click', function () {
			callback();
		});
		button.addEventListener('mouseenter', () => {
			addClass(button, 'hover');
		});
		button.addEventListener('mouseleave', () => {
			removeClass(button, 'hover');
		});
		return button;
	};

	const DEFAULT_SEARCH_BATCH_SIZE = 91;
	const MILLIS_IN_SECOND = 1000;
	const wait = async (maxWaitTime = 2) => {
		const factor = Math.random();
		await new Promise((resolve) =>
			setTimeout(resolve, factor * maxWaitTime * MILLIS_IN_SECOND)
		);
	};
	const fetchPlayers = ({ count = Infinity, level, rarities, sort } = {}) => {
		return new Promise((resolve) => {
			services.Club.clubDao.resetStatsCache();
			services.Club.getStats();
			let offset = 0;
			const batchSize = DEFAULT_SEARCH_BATCH_SIZE;
			let result = [];
			const fetchPlayersInner = () => {
				searchClub({
					count: batchSize,
					level,
					rarities,
					offset,
					sort,
				}).observe(undefined, async (sender, response) => {
					result = [...response.response.items];

					if (
						result.length < count &&
						Math.floor(response.status / 100) === 2 &&
						!response.response.retrievedAll
					) {
						offset += batchSize;

						fetchPlayersInner();
						return;
					}
					// TODO: Handle statusCodes
					if (count) {
						result = result.slice(0, count);
					}
					resolve(result);
				});
			};
			fetchPlayersInner();
		});
	};

	const searchClub = ({ count, level, rarities, offset, sort }) => {
		const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
		if (count) {
			searchCriteria.count = count;
		}
		if (level) {
			searchCriteria.level = level;
		}
		if (sort) {
			searchCriteria._sort = sort;
		}
		if (rarities) {
			searchCriteria.rarities = rarities;
		}
		if (offset) {
			searchCriteria.offset = offset;
		}
		return services.Club.search(searchCriteria);
	};
	let conceptPlayersCollected = false;
	const getConceptPlayers = function () {
		return new Promise((resolve, reject) => {
			const gatheredPlayers = [];
			const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
			searchCriteria.offset = 0;
			searchCriteria.count = DEFAULT_SEARCH_BATCH_SIZE;
			const getAllConceptPlayers = () => {
				searchConceptPlayers(searchCriteria).observe(
					this,
					async function (sender, response) {
						gatheredPlayers.push(...response.response.items);
						if (response.status !== 400 && !response.response.endOfList) {
							searchCriteria.offset += searchCriteria.count;
							console.log(searchCriteria.offset);

							getAllConceptPlayers();
						} else {
							conceptPlayersCollected = true;
							showNotification(
								'Collected All Concept Players',
								UINotificationType.POSITIVE
							);
							resolve(gatheredPlayers);
						}
					}
				);
			};
			getAllConceptPlayers();
		});
	};
	const sendUnassignedtoTeam = async () => {
		repositories.Item.unassigned.clear();
		repositories.Item.unassigned.reset();
		let ulist = await fetchUnassigned();
		services.Item.move(
			ulist.filter((l) => l.duplicateId == 0 && l.type == 'player'),
			7
		).observe(this, function (obs, event) {});
	};
	const searchConceptPlayers = (searchCriteria) => {
		return services.Item.searchConceptItems(searchCriteria);
	};
	const fetchUnassigned = () => {
		return new Promise((resolve) => {
			let result = [];
			services.Item.requestUnassignedItems().observe(
				undefined,
				async (sender, response) => {
					result = [...response.response.items];

					resolve(result);
				}
			);
		});
	};
	const fetchDuplicateIds = () => {
		return new Promise((resolve) => {
			const result = [];
			services.Item.requestUnassignedItems().observe(
				undefined,
				async (sender, response) => {
					const duplicates = [
						...response.response.items.filter((item) => item.duplicateId > 0),
					];
					result.push(...duplicates.map((duplicate) => duplicate.duplicateId));
					resolve(result);
				}
			);
		});
	};

	let ApiUrl = 'http://127.0.0.1:8000/solve';

	let LOCKED_ITEMS_KEY = 'lockeditems';
	let cachedLockedItems;
	let isItemLocked = function (item) {
		let lockedItems = getLockedItems();
		return lockedItems.includes(item.id);
	};
	let lockItem = function (item) {
		let lockedItems = getLockedItems();
		lockedItems.push(item.id);
		saveLockedItems();
	};
	let unlockItem = function (item) {
		let lockedItems = getLockedItems();

		if (lockedItems.includes(item.id)) {
			const index = lockedItems.indexOf(item.id);
			if (index > -1) {
				// only splice array when item is found
				lockedItems.splice(index, 1); // 2nd parameter means remove one item only
			}
		}
		saveLockedItems();
	};
	let getLockedItems = function () {
		if (cachedLockedItems) {
			return cachedLockedItems;
		}
		cachedLockedItems = [];
		let lockedItems = localStorage.getItem(LOCKED_ITEMS_KEY);
		if (lockedItems) {
			cachedLockedItems = JSON.parse(lockedItems);
		}
		return cachedLockedItems;
	};
	let lockedItemsCleanup = function (clubPlayerIds) {
		let lockedItems = getLockedItems();
		for (let _i = 0, _a = Array.from(lockedItems); _i < _a.length; _i++) {
			let lockedItem = _a[_i];
			if (!clubPlayerIds[lockedItem]) {
				const index = lockedItems.indexOf(lockedItem);
				if (index > -1) {
					// only splice array when item is found
					lockedItems.splice(index, 1); // 2nd parameter means remove one item only
				}
			}
		}
		saveLockedItems();
	};
	let saveLockedItems = function () {
		localStorage.setItem(LOCKED_ITEMS_KEY, JSON.stringify(cachedLockedItems));
	};

	let FIXED_ITEMS_KEY = 'fixeditems';
	let cachedFixedItems;
	let isItemFixed = function (item) {
		let fixedItems = getFixedItems();
		return fixedItems.includes(item.id);
	};
	let fixItem = function (item) {
		let fixedItems = getFixedItems();
		fixedItems.push(item.id);
		saveFixedItems();
	};
	let unfixItem = function (item) {
		let fixedItems = getFixedItems();

		if (fixedItems.includes(item.id)) {
			const index = fixedItems.indexOf(item.id);
			if (index > -1) {
				// only splice array when item is found
				fixedItems.splice(index, 1); // 2nd parameter means remove one item only
			}
		}
		saveFixedItems();
	};
	let getFixedItems = function () {
		if (cachedFixedItems) {
			return cachedFixedItems;
		}
		cachedFixedItems = [];
		let fixedItems = localStorage.getItem(FIXED_ITEMS_KEY);
		if (fixedItems) {
			cachedFixedItems = JSON.parse(fixedItems);
		}
		return cachedFixedItems;
	};
	let fixedItemsCleanup = function (clubPlayerIds) {
		let fixedItems = getFixedItems();
		for (let _i = 0, _a = Array.from(fixedItems); _i < _a.length; _i++) {
			let fixedItem = _a[_i];
			if (!clubPlayerIds[fixedItem]) {
				const index = fixedItems.indexOf(fixedItem);
				if (index > -1) {
					// only splice array when item is found
					fixedItems.splice(index, 1); // 2nd parameter means remove one item only
				}
			}
		}
		saveFixedItems();
	};
	let saveFixedItems = function () {
		localStorage.setItem(FIXED_ITEMS_KEY, JSON.stringify(cachedFixedItems));
	};

	const idToPlayerItem = {};
	const showLoader = () => {
		addClass(getElement('.ut-click-shield'), 'showing');
		css(getElement('.loaderIcon'), {
			display: 'block',
		});
	};
	const hideLoader = () => {
		removeClass(getElement('.ut-click-shield'), 'showing');
		css(getElement('.loaderIcon'), {
			display: 'block',
		});
	};
	const showNotification = function (
		message,
		type = UINotificationType.POSITIVE
	) {
		services.Notification.queue([message, type]);
	};
	const getCurrentViewController = () => {
		return getAppMain()
			.getRootViewController()
			.getPresentedViewController()
			.getCurrentViewController();
	};
	const getControllerInstance = () => {
		return getCurrentViewController().getCurrentController()
			._childViewControllers[0];
	};

	const sbcSets = async function () {
		return new Promise((resolve, reject) => {
			// Search in the club
			services.SBC.requestSets().observe(this, async function (obs, res) {
				if (!res.success) {
					obs.unobserve(this);
					reject(res.status);
				} else {
					resolve(res.data);
				}
			});
		});
	};

	const sbcChallenges = async function (set) {
		return new Promise((resolve, reject) => {
			// Search in the club
			services.SBC.requestChallengesForSet(set).observe(
				this,
				async function (obs, res) {
					if (!res.success) {
						obs.unobserve(this);
						reject(res.status);
					} else {
						resolve(res.data);
					}
				}
			);
		});
	};

	const loadChallenge = async function (currentChallenge) {
		return new Promise((resolve, reject) => {
			// Search in the club
			services.SBC.loadChallenge(currentChallenge).observe(
				this,
				async function (obs, res) {
					if (!res.success) {
						obs.unobserve(this);
						reject(res.status);
					} else {
						resolve(res.data);
					}
				}
			);
		});
	};

	const fetchSBCData = async (sbcId, challengeId = 0) => {
		//Get SBC Data if given a setId

		let sbcData = await sbcSets();
		let sbcSet = sbcData.sets.filter((e) => e.id == sbcId)[0];
		let challenges = await sbcChallenges(sbcSet);
		if (challengeId == 0) {
			console.log(challenges);
			//Get last/hardest SBC if no challenge given
			let uncompletedChallenges = challenges?.challenges.filter(
				(f) => f.status != 'COMPLETED'
			);
			challengeId = uncompletedChallenges[uncompletedChallenges.length - 1].id;
		}

		await loadChallenge(
			challenges.challenges.filter((i) => i.id == challengeId)[0]
		);
		let newSbcSquad = new UTSBCSquadOverviewViewController();
		newSbcSquad.initWithSBCSet(sbcSet, challengeId);
		let { _challenge } = newSbcSquad;

		const challengeRequirements = _challenge.eligibilityRequirements.map(
			(eligibility) => {
				let keys = Object.keys(eligibility.kvPairs._collection);
				return {
					scope: SBCEligibilityScope[eligibility.scope],
					count: eligibility.count,
					requirementKey: SBCEligibilityKey[keys[0]],
					eligibilityValues: eligibility.kvPairs._collection[keys[0]],
				};
			}
		);
		return {
			constraints: challengeRequirements,
			formation: _challenge.squad._formation.generalPositions.map((m, i) =>
				_challenge.squad.simpleBrickIndices.includes(i) ? -1 : m
			),
			challengeId: _challenge.id,
			setId: _challenge.setId,
			brickIndices: _challenge.squad.simpleBrickIndices,
			currentSolution: _challenge.squad._players.map(
				(m) => m._item._metaData?.id
			),
		};
	};
	let conceptPlayers;
	const futHomeOverride = () => {
		const homeHubInit = UTHomeHubView.prototype.init;
		UTHomeHubView.prototype.init = async function () {
			homeHubInit.call(this);
			createSBCTab();
			let players = await fetchPlayers();

			await fetchLowestPriceByRating();
			await fetchPlayerPrices(players);
			if (useConcept) {
				conceptPlayers = await getConceptPlayers();
				await fetchPlayerPrices(conceptPlayers);
			}
		};
	};
	let useConcept = false;
	const duplicateDiscount = 0.1;
	const untradeableDiscount = 0.8;
	const conceptPremium = 10;
	const solveSBC = async (sbcData) => {
		showLoader();
		let players = await fetchPlayers();

		let duplicateIds = await fetchDuplicateIds();
		for (let item of players) {
			idToPlayerItem[item.definitionId] = item;
		}
		await fetchPlayerPrices(players);
		if (useConcept) {
			if (conceptPlayersCollected) {
				players = players.concat(conceptPlayers);
			} else {
				showNotification(
					'Still Collecting Concept Players, They will not be used for this solution',
					UINotificationType.NEGATIVE
				);
			}
		}
		let backendPlayersInput = players
			.filter(
				(item) =>
					item.loans < 0 &&
					(!isItemLocked(item) || duplicateIds.includes(item.id))
			)
			.map((item) => {
				if (!item.groups.length) {
					item.groups = [0];
				}

				return {
					id: item.id,
					name: item._staticData.name,
					cardType:
						(item.isSpecial()
							? ''
							: services.Localization.localize(
									'search.cardLevels.cardLevel' + item.getTier()
							  ) + ' ') +
						services.Localization.localize('item.raretype' + item.rareflag),
					assetId: item._metaData?.id,
					definitionId: item.definitionId,
					rating: item.rating,
					teamId: item.teamId,
					leagueId: item.leagueId,
					nationId: item.nationId,
					rarityId: item.rareflag,
					ratingTier: item.getTier(),
					isUntradeable: item.untradeable,
					isDuplicate: duplicateIds.includes(item.id),
					preferredPosition: item.preferredPosition,
					possiblePositions: item.possiblePositions,
					groups: item.groups,
					isFixed: isItemFixed(item),
					concept: item.concept,
					price:
						getPrice(item) *
							(duplicateIds.includes(item.id) ? duplicateDiscount : 1) *
							(item.untradeable ? untradeableDiscount : 1) *
							(isItemFixed(item) ? 0 : 1) *
							(item.concept ? conceptPremium : 1) -
						(100 - item.rating),
				};
			});

		const input = JSON.stringify({
			clubPlayers: backendPlayersInput,
			sbcData: sbcData,
		});
		console.log('Sending SBC to Solve...');
		let solution = await makePostRequest(ApiUrl, input);
		console.log(solution);
		if (solution.status_code != 2 && solution.status_code != 4) {
			hideLoader();
			showNotification(solution.status, UINotificationType.NEGATIVE);
			return;
		}
		showNotification(
			solution.status,
			solution.status_code != 4
				? UINotificationType.NEUTRAL
				: UINotificationType.POSITIVE
		);
		let allSbcData = await sbcSets();
		let sbcSet = allSbcData.sets.filter((e) => e.id == sbcData.setId)[0];
		let challenges = await sbcChallenges(sbcSet);
		await loadChallenge(
			challenges.challenges.filter((i) => i.id == sbcData.challengeId)[0]
		);
		let newSbcSquad = new UTSBCSquadOverviewViewController();
		newSbcSquad.initWithSBCSet(sbcSet, sbcData.challengeId);
		let { _squad, _challenge } = newSbcSquad;
		_squad.removeAllItems();

		let _solutionSquad = [...Array(11)];
		sbcData.brickIndices.forEach(function (item, index) {
			_solutionSquad[item] = new UTItemEntity();
		});
		JSON.parse(solution.results)
			.sort((a, b) => b.Is_Pos - a.Is_Pos)
			.forEach(function (item, index) {
				let findMap = sbcData.formation.map(
					(currValue, idx) =>
						((currValue == item.possiblePositions && item.Is_Pos == 1) ||
							item.Is_Pos == 0) &&
						_solutionSquad[idx] == undefined
				);

				_solutionSquad[
					findMap.findIndex((element) => {
						return element;
					})
				] = players.filter((f) => item.id == f.id)[0];
			});
		_squad.setPlayers(_solutionSquad, true);
		services.SBC.saveChallenge(_challenge).observe(
			undefined,
			async function (sender, data) {
				if (!data.success) {
					showNotification(
						'Failed to save squad.',
						UINotificationType.NEGATIVE
					);
					_squad.removeAllItems();
					hideLoader();
					if (data.error) {
						showNotification(
							`Error code: ${data.error.code}`,
							UINotificationType.NEGATIVE
						);
					}
					return;
				}
				await loadChallenge(_challenge);
			}
		);
		if (solution.status_code == 4) {
			console.log(_challenge, sbcSet);
			services.SBC.submitChallenge(_challenge, _challenge.setId, true).observe(
				this,
				async function (obs, res) {
					if (!res.success) {
						obs.unobserve(this);
						console.log(res);
					} else {
						console.log(res);
					}
				}
			);
		}

		hideLoader();
	};
	const sbcViewOverride = () => {
		const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
		UTSBCSquadDetailPanelView.prototype.init = function (...args) {
			const response = squadDetailPanelView.call(this, ...args);

			const button = createButton('idSolveSbc', 'Solve SBC', async function () {
				const { _challenge } = getControllerInstance();
				let sbcSolveData = await fetchSBCData(_challenge.setId, _challenge.id);
				solveSBC(sbcSolveData);
			});
			insertAfter(button, this._btnExchange.__root);
			return response;
		};
	};
	const sbcButtonOverride = () => {
		const UTSBCSetTileView_render = UTSBCSetTileView.prototype.render;
		UTSBCSetTileView.prototype.render = function render() {
			UTSBCSetTileView_render.call(this);
			if (this.data) {
				insertBefore(
					createElem('span', null, `COMPLETED: ${this.data.timesCompleted}. `),
					this.__rewardsHeader
				);
			}
		};
	};

	const lockedLabel = 'SBC Unlock';
	const unlockedLabel = 'SBC Lock';
	const fixedLabel = 'SBC Use actual prices';
	const unfixedLabel = 'SBC Set Price to Zero';
	const playerItemOverride = () => {
		const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
		UTSlotActionPanelView.prototype.setItem = function (e, t) {
			const result = UTDefaultSetItem.call(this, e, t);
			// Concept player
			if (e.concept || e.isLoaned() || !e.isPlayer() || !e.id) {
				return result;
			}
			if (!e.isDuplicate() && !isItemFixed(e)) {
				const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
				const button = new UTGroupButtonControl();
				button.init();
				button.setInteractionState(true);
				button.setText(label);
				insertBefore(button, this._btnPlayerBio.__root);
				button.addTarget(
					this,
					async () => {
						if (isItemLocked(e)) {
							unlockItem(e);
							button.setText(unlockedLabel);
							showNotification(`Item unlocked`, UINotificationType.POSITIVE);
						} else {
							lockItem(e);
							button.setText(lockedLabel);
							showNotification(`Item locked`, UINotificationType.POSITIVE);
						}
						getControllerInstance().applyDataChange();
						getCurrentViewController()
							.getCurrentController()
							._rightController._currentController._renderView();
					},
					EventType.TAP
				);
			}
			if (!isItemLocked(e)) {
				const fixLabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
				const fixbutton = new UTGroupButtonControl();
				fixbutton.init();
				fixbutton.setInteractionState(true);
				fixbutton.setText(fixLabel);
				insertBefore(fixbutton, this._btnPlayerBio.__root);
				fixbutton.addTarget(
					this,
					async () => {
						if (isItemFixed(e)) {
							unfixItem(e);
							fixbutton.setText(unfixedLabel);
							showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
						} else {
							fixItem(e);
							fixbutton.setText(fixedLabel);
							showNotification(`Must Use Set`, UINotificationType.POSITIVE);
						}
						getControllerInstance().applyDataChange();
						getCurrentViewController()
							.getCurrentController()
							._rightController._currentController._renderView();
					},
					EventType.TAP
				);
			}
			return result;
		};
		const UTDefaultAction = UTDefaultActionPanelView.prototype.render;
		UTDefaultActionPanelView.prototype.render = function (e, t, i, o, n, r, s) {
			const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
			// Concept player
			if (e.concept || e.isLoaned() || !e.isPlayer() || !e.id) {
				return result;
			}
			if (!e.isDuplicate() && !isItemFixed(e)) {
				const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
				if (!this.lockUnlockButton) {
					const button = new UTGroupButtonControl();
					button.init();
					button.setInteractionState(true);
					button.setText(label);
					insertBefore(button, this._playerBioButton.__root);
					button.addTarget(
						this,
						async () => {
							if (isItemLocked(e)) {
								unlockItem(e);
								button.setText(unlockedLabel);
								showNotification(`Item unlocked`, UINotificationType.POSITIVE);
							} else {
								lockItem(e);
								button.setText(lockedLabel);
								showNotification(`Item locked`, UINotificationType.POSITIVE);
							}
							getCurrentViewController()
								.getCurrentController()
								._leftController.refreshList();
						},
						EventType.TAP
					);
					this.lockUnlockButton = button;
				}
			}
			if (!isItemLocked(e)) {
				const fixlabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
				if (!this.fixUnfixButton) {
					const button = new UTGroupButtonControl();
					button.init();
					button.setInteractionState(true);
					button.setText(fixlabel);
					insertBefore(button, this._playerBioButton.__root);
					button.addTarget(
						this,
						async () => {
							if (isItemFixed(e)) {
								unfixItem(e);
								button.setText(unfixedLabel);
								showNotification(
									`Removed Must Use`,
									UINotificationType.POSITIVE
								);
							} else {
								fixItem(e);
								button.setText(fixedLabel);
								showNotification(`Must Use Set`, UINotificationType.POSITIVE);
							}
							getCurrentViewController()
								.getCurrentController()
								._leftController.refreshList();
						},
						EventType.TAP
					);
					this.fixUnfixButton = button;
				}
			}
			return result;
		};
		const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
		UTPlayerItemView.prototype.renderItem = function (item, t) {
			const result = UTPlayerItemView_renderItem.call(this, item, t);
			if (getPrice(item)) {
				let price = getPrice(item) * (isItemFixed(item) ? 0 : 1);
				this.__root.prepend(
					createElem(
						'div',
						{ className: 'currency-coins item-price' },
						price.toLocaleString()
					)
				);
			}
			if (isItemLocked(item)) {
				addClass(this, 'locked');
			} else {
				removeClass(this, 'locked');
			}
			if (isItemFixed(item)) {
				addClass(this, 'fixed');
			} else {
				removeClass(this, 'fixed');
			}
			return result;
		};
	};

	let priceCacheMinutes = 60;
	let PRICE_ITEMS_KEY = 'futbinprices';
	let cachedPriceItems;

	let getPrice = function (item) {
		let PriceItems = getPriceItems();
		let expiryTimeStamp = new Date(
			PriceItems[item.definitionId]?.expiryTimeStamp
		);
		if (
			PriceItems[item.definitionId] &&
			PriceItems[item.definitionId]?.expiryTimeStamp &&
			expiryTimeStamp < Date.now()
		) {
			return null;
		}
		return PriceItems[item.definitionId]?.price;
	};

	let PriceItem = function (item, price, expiryDate) {
		let PriceItems = getPriceItems();
		let expiryTimeStamp =
			expiryDate || new Date(Date.now() + priceCacheMinutes * 60 * 1000);
		PriceItems[item.definitionId] = {
			expiryTimeStamp: expiryTimeStamp,
			price: price,
		};
		savePriceItems();
	};

	let getPriceItems = function () {
		if (cachedPriceItems) {
			return cachedPriceItems;
		}
		cachedPriceItems = {};
		let PriceItems = localStorage.getItem(PRICE_ITEMS_KEY);
		if (PriceItems) {
			cachedPriceItems = JSON.parse(PriceItems);
		}

		return cachedPriceItems;
	};
	let PriceItemsCleanup = function (clubPlayerIds) {
		let PriceItems = getPriceItems();
		for (let _i = 0, _a = Array.from(PriceItems); _i < _a.length; _i++) {
			let PriceItem = _a[_i];
			if (!clubPlayerIds[PriceItem]) {
				PriceItems.delete(PriceItem);
			}
		}
		savePriceItems();
	};
	let savePriceItems = function () {
		localStorage.setItem(PRICE_ITEMS_KEY, JSON.stringify(cachedPriceItems));
	};

	function makeGetRequest(url) {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: url,
				onload: function (response) {
					resolve(response.responseText);
				},
				onerror: function (error) {
					reject(error);
				},
			});
		});
	}

	function makePostRequest(url, data) {
		return new Promise((resolve, reject) => {
			fetch(url, {
				method: 'POST',
				body: data,
			})
				.then((response) => {
					// 1. check response.ok
					if (response.ok) {
						return response.json();
					}
					return Promise.reject(response); // 2. reject instead of throw
				})
				.then((json) => {
					console.log(json);
					resolve(json);
				})
				.catch((error) => {
					console.log(error);
					showNotification(
						`Please check backend API is running`,
						UINotificationType.NEGATIVE
					);
					hideLoader();
				});
		});
	}
	const convertAbbreviatedNumber = (number) => {
		let base = parseFloat(number);
		if (number.toLowerCase().match(/k/)) {
			return Math.round(base * 1000);
		} else if (number.toLowerCase().match(/m/)) {
			return Math.round(base * 1000000);
		}
		return number * 1;
	};
	const fetchLowestPriceByRating = async () => {
		const futBinCheapestByRatingResponse = await makeGetRequest(
			`https://www.futbin.com/home-tab/cheapest-by-rating`
		);
		$(futBinCheapestByRatingResponse)
			.find('#cheapest-players-row')
			.find('.col-9')
			.each(function (i, obj) {
				PriceItem(
					{
						definitionId:
							obj.innerText.replace('Rated players', '').trim() + '_CBR',
					},
					convertAbbreviatedNumber(
						$(futBinCheapestByRatingResponse)
							.find('#cheapest-players-row')
							.find('.d-none')
							[i * 5].innerText.trim()
					)
				);
			});
	};
	const fetchPlayerPrices = async (players) => {
		const idsArray = players
			.filter((f) => getPrice(f) == null)
			.map((p) => p.definitionId);

		while (idsArray.length) {
			const playersIdArray = idsArray.splice(0, 30);
			const primaryId = playersIdArray.shift();
			if (!primaryId) {
				continue;
			}
			const refIds = playersIdArray.join(',');
			const futBinResponse = await makeGetRequest(
				`https://www.futbin.com/24/playerPrices?player=${primaryId}&rids=${refIds}`
			);
			let priceResponse;
			try {
				priceResponse = JSON.parse(futBinResponse);
			} catch (error) {
				console.log(futBinResponse);
				console.error(error);
				await wait();
				continue;
			}
			for (const id of [primaryId, ...playersIdArray]) {
				const prices = priceResponse[id]?.prices[getUserPlatform()];

				const lcPrice = prices.LCPrice;

				if (!lcPrice) {
					continue;
				}
				let cardPrice = parseInt(lcPrice.replace(/[,.]/g, ''));
				let player = players.filter((f) => f.definitionId == id)[0];
				if (cardPrice == 0) {
					console.log(prices, player);

					if (!prices.updated) {
						await fetchPlayerPrices(
							players.filter((f) => f.definitionId == id)
						);
						continue;
					}
					const maxPrice =
						player._itemPriceLimits?.maximum ||
						parseInt(prices.MaxPrice.replace(/[,.]/g, ''));
					const minPrice =
						player._itemPriceLimits?.minimum ||
						parseInt(prices.MinPrice.replace(/[,.]/g, ''));
					const cbrPrice = getPrice({ definitionId: player._rating + '_CBR' });
					cardPrice = maxPrice;

					if (prices.updated == 'Never' || prices.updated.includes('week')) {
						//never indicates its not on the market so give it the lowest price of the rating with a premium
						cardPrice = player.isSpecial()
							? Math.min(Math.max(cbrPrice * 1.5, minPrice), maxPrice)
							: minPrice;
					}
				}
				if (player.concept) {
					PriceItem(
						player,
						cardPrice,
						player.isSpecial()
							? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
							: new Date(Date.now() + 24 * 60 * 60 * 1000)
					);
				} else {
					PriceItem(player, cardPrice);
				}
			}
			await wait();
		}
	};

	const storeOverride = async () => {
		const storeView = UTStorePackDetailsView.prototype._generate;

		UTStorePackDetailsView.prototype._generate = async function (...args) {
			const result = storeView.call(this, ...args);
			await sendUnassignedtoTeam();
			console.log('Unassigned sent');
			return result;
		};
	};
	const playerSlotOverride = () => {
		const playerSlot = UTSquadPitchView.prototype.setSlots;

		UTSquadPitchView.prototype.setSlots = async function (...args) {
			const result = playerSlot.call(this, ...args);
			const slots = this.getSlotViews();
			const squadSlots = [];
			slots.forEach((slot, index) => {
				const item = args[0][index];
				squadSlots.push({
					item: item._item,
					rootElement: slot.getRootElement(),
				});
			});

			appendSlotPrice(squadSlots);
			return result;
		};
	};

	const appendSlotPrice = async (squadSlots) => {
		if (!squadSlots.length) {
			return;
		}
		const players = [];
		for (const { item } of squadSlots) {
			players.push(item);
		}

		const prices = await fetchPlayerPrices(players);
		let total = 0;
		for (const { rootElement, item } of squadSlots) {
			const cardPrice = getPrice(item);
			total += cardPrice || 0;

			if (cardPrice) {
				const element = $(rootElement);
				appendPriceToSlot(element, cardPrice);
			}
		}
		appendSquadTotal(total);
	};
	const appendSquadTotal = (total) => {
		if ($('.squadTotal').length) {
			$('.squadTotal').text(total.toLocaleString());
		} else {
			$(
				`<div class="rating chemistry-inline">
          <span class="ut-squad-summary-label">Squad Price</span>
          <div>
            <span class="ratingValue squadTotal currency-coins">${total.toLocaleString()}</span>
          </div>
        </div>
        `
			).insertAfter($('.chemistry'));
		}
	};
	const appendPriceToSlot = (rootElement, price) => {
		rootElement.prepend(
			createElem(
				'div',
				{ className: 'currency-coins item-price' },
				price.toLocaleString()
			)
		);
	};
	const getUserPlatform = () => {
		if (services.User.getUser().getSelectedPersona().isPC) {
			return 'pc';
		}
		return 'ps';
	};
	const favTagOverride = () => {
		const favTag = UTSBCFavoriteButtonControl.prototype.watchSBCSet;

		UTSBCFavoriteButtonControl.prototype.watchSBCSet = async function () {
			const result = favTag.call(this);
			await createSBCTab();
			return result;
		};
	};

	const createSBCTab = async () => {
		console.log('Creating Favourites Bar');
		let sets = await sbcSets();
		let favourites = sets.categories.filter((f) => f.name == 'Favourites')[0]
			.setIds;
		let favouriteSBCSets = sets.sets.filter((f) => favourites.includes(f.id));
		let tiles = [];
		$('.sbc-auto').remove();
		if ($('.ut-tab-bar-view').find('.sbc-auto').length === 0) {
			let NewTab =
				'<nav class="ut-tab-bar sbc-auto"/><button class="ut-tab-bar-item"><span>SBC 1-click Favourites</span></button>';
			$('.ut-tab-bar-view').prepend(NewTab);
		}
		favouriteSBCSets.forEach(function (e) {
			var t = new UTSBCSetTileView();
			t.init(), (t.title = e.name), t.setData(e), t.render();
			$('.sbc-auto').append(
				"<button class='ut-tab-bar-item' id=" +
					e.id +
					'><img src=' +
					t._setImage.src +
					" alt='sbc img' width='50' height='50'/><span>" +
					e.name +
					'</span></button>'
			);
			$('#' + e.id).click(async function () {
				services.Notification.queue([
					e.name + ' SBC Started',
					UINotificationType.POSITIVE,
				]);
				let sbcSolveData = await fetchSBCData(e.id, 0);
				solveSBC(sbcSolveData);
			});
		});
	};

	const sideBarNavOverride = () => {
		const navViewInit =
			UTGameTabBarController.prototype.initWithViewControllers;
		UTGameTabBarController.prototype.initWithViewControllers = function (tabs) {
			const sbcSolveNav = new UTGameFlowNavigationController();
			sbcSolveNav.initWithRootController(new sbcSettingsController());
			sbcSolveNav.tabBarItem = generateSbcSolveTab();
			tabs.push(sbcSolveNav);
			navViewInit.call(this, tabs);
		};
	};

	let eventMappers = new Set();

	const clickHandler = (key, evt) => {
		const sbcSolverSetting = getValue('sbcSolverSettings') || {};
		if (sbcSolverSetting[key]) {
			sbcSolverSetting[key] = false;
			$(evt.currentTarget).removeClass('toggled');
		} else {
			sbcSolverSetting[key] = true;
			$(evt.currentTarget).addClass('toggled');
		}
		setValue('sbcSolverSettings', sbcSolverSetting);
	};

	const resetKeyToDefault = (key) => {
		const sbcSolverSetting = getValue('sbcSolverSettings') || {};
		sbcSolverSetting[key] = false;
		setValue('sbcSolverSettings', sbcSolverSetting);
	};

	const generateToggleInput = (
		label,
		id,
		info,
		isToggled,
		additionalClasses = 'settings-field'
	) => {
		const key = id;
		if (isToggled) {
			resetKeyToDefault(key);
			setTimeout(() => {
				$(`#${id[key]}`).click();
			});
		}
		if (!eventMappers.has(key)) {
			$(document).on('click touchend', `#${id[key]}`, (evt) => {
				clickHandler(key, evt);
			});
			eventMappers.add(key);
		}
		return `
    <div class="price-filter  ${additionalClasses}">
        <div class="ut-toggle-cell-view">
           <span class="ut-toggle-cell-view--label">${label} <br/><small>${info}</small></span>
             <div id='${id[key]}' class="ut-toggle-control">
               <div class="ut-toggle-control--track">
              </div>
              <div class= "ut-toggle-control--grip" >
          </div>
           </div>
       </div>
    </div> `;
	};

	const defaultSBCSolverSettings = {
		ApiUrl: 'http://127.0.0.1:8000/solve',
		useConcept: false,
		showFavouritesToolBar: true,
		showPrices: true,
		maxSolveTime: 120,
		autoSubmit: 'Optimal',
		showSolverLoadingScreen: true,
		priceCacheMinutes: 60,
	};

	const generateSbcSolveTab = () => {
		const sbcSolveTab = new UTTabBarItemView();
		sbcSolveTab.init();
		sbcSolveTab.setTag(6);
		sbcSolveTab.setText('SBC Solver');
		sbcSolveTab.addClass('icon-sbcSettings');
		return sbcSolveTab;
	};

	const sbcSettingsController = function (t) {
		UTViewController.call(this);
	};

	JSUtils.inherits(sbcSettingsController, UTViewController);

	sbcSettingsController.prototype._getViewInstanceFromData = function () {
		return new sbcSettingsView();
	};

	sbcSettingsController.prototype.viewDidAppear = function () {
		this.getNavigationController().setNavigationVisibility(true, true);
	};

	sbcSettingsController.prototype.getNavigationTitle = function () {
		return 'SBC Solver';
	};

	const sbcSettingsView = function (t) {
		UTView.call(this);
	};

	JSUtils.inherits(sbcSettingsView, UTView);

	let idShowSquadPrice;
	sbcSettingsView.prototype._generate = function _generate() {
		if (!this._generated) {
			let container = document.createElement('div');
			container.classList.add('ut-market-search-filters-view');
			container.classList.add('floating');
			container.style['overflow-y'] = 'scroll';
			container.style['display'] = 'flex';
			container.style['align-items'] = 'center';
			let wrapper = document.createElement('div');
			wrapper.style['height'] = '100%';
			wrapper.appendChild(
				$(` <div class='sbcSolver-settings-wrapper ut-pinned-list'>
          <div class="sbcSolver-settings-header">
          <h1 class="secondary">SBC Solver Settings</h1>
          ${generateToggleInput(
						'showSquadPrice',
						idShowSquadPrice,
						'showSquadPriceInfo',
						true
					)}
          `)[0]
			);
			container.appendChild(wrapper);
			this.__root = container;
			this._generated = !0;
		}
	};

	const init = () => {
		sbcViewOverride();
		futHomeOverride();
		sbcButtonOverride();
		playerItemOverride();
		playerSlotOverride();
		storeOverride();
		sideBarNavOverride();
		//favTagOverride();
	};
	init();
})();

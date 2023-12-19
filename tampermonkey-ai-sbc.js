// ==UserScript==
// @name         FIFA AI SBC
// @namespace    http://tampermonkey.net/
// @version      1
// @description  try to take over the world!
// @author       TitiroMonkey
// @match        https://www.easports.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @grant        GM_xmlhttpRequest

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
			showNotification('Fetching club players');
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

	const getConceptPlayerItem = (definitionId) => {
		const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
		searchCriteria.defId = [definitionId];
		return new Promise((resolve, reject) => {
			services.Item.searchConceptItems(searchCriteria).observe(
				undefined,
				async (sender, response) => {
					const result = [
						...response.response.items.filter(
							(item) => item.definitionId === definitionId
						),
					];
					if (result.length !== 1) {
						reject(new Error(`defId: ${definitionId} not found`));
					}
					resolve(result[0]);
				}
			);
		});
	}; // CONCATENATED MODULE: ./src/pages/Content/utils/constants.ts
	let ApiUrl = 'http://127.0.0.1:8000/solve';
	let MessageType;
	(function (MessageType) {
		MessageType[(MessageType['BACKEND_RESULT'] = 0)] = 'BACKEND_RESULT';
		MessageType[(MessageType['NOT_AUTHENTICATED'] = 1)] = 'NOT_AUTHENTICATED';
		MessageType[(MessageType['POST_REQUEST'] = 2)] = 'POST_REQUEST';
		MessageType[(MessageType['BACKEND_ERROR'] = 3)] = 'BACKEND_ERROR';
		MessageType[(MessageType['UNEXPECTED_ERROR'] = 4)] = 'UNEXPECTED_ERROR';
	})(MessageType || (MessageType = {}));
	let createMessage = function (type, body) {
		return { type: type, body: body };
	};

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

	const fetchSBCData = () => {
		const { _challenge } = getControllerInstance();
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
		};
	};
	const futHomeOverride = () => {
		const homeHubInit = UTHomeHubView.prototype.init;
		UTHomeHubView.prototype.init = async function () {
			homeHubInit.call(this);
			let players = await fetchPlayers();
			await fetchPlayerPrices(players);
		};
	};
	const sbcViewOverride = () => {
		const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
		UTSBCSquadDetailPanelView.prototype.init = function (...args) {
			const response = squadDetailPanelView.call(this, ...args);
			const button = createButton('idSolveSbc', 'Solve SBC', async () => {
				let sbcData = fetchSBCData();

				showLoader();
				let players = await fetchPlayers();

				let duplicateIds = await fetchDuplicateIds();
				for (let item of players) {
					idToPlayerItem[item.definitionId] = item;
				}
				await fetchPlayerPrices(players);
				let backendPlayersInput = players
					.filter((item) => item.loans < 0 && !isItemLocked(item))
					.map((item) => {
						if (!item.groups.length) {
							console.log(item);
							item.groups = [0];
						}

						return {
							id: item.id,
							name: item._staticData.name,
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
							price:
								getPrice(item) *
									(duplicateIds.includes(item.id) ? 0.1 : 1) *
									(item.untradeable ? 0.8 : 1) -
								(100 - item.rating),
						};
					});
				try {
					// Clean locked items that are not in the club anymore. We perform the cleanup approximately once per 20 times
					if (Math.random() > 0.95) {
						lockedItemsCleanup(idToPlayerItem);
					}
				} catch (error) {
					// Do nothing
				}
				const input = JSON.stringify({
					clubPlayers: backendPlayersInput,
					sbcData: sbcData,
					duplicates: duplicateIds,
					// TODO: make this a togle button
					//useConceptPlayers: true,
				});
				console.log('Sending SBC to Solve...');

				showNotification('Sending SBC to Solve...');
				let solution = await makePostRequest(ApiUrl, input);

				console.log(solution);
				const { _squad, _challenge } = getControllerInstance();
				_squad.removeAllItems();

				let _solutionSquad = [...Array(11)];
				sbcData.brickIndices.forEach(function (item, index) {
					_solutionSquad[item] = new UTItemEntity();
				});
				console.log(_solutionSquad);
				solution
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
						services.SBC.loadChallenge(_challenge).observe(
							this,
							async function (sender, data) {
								hideLoader();
							}
						);
					}
				);
				hideLoader();
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

	const lockedLabel = 'Unlock';
	const unlockedLabel = 'Lock';
	const playerItemOverride = () => {
		const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
		UTSlotActionPanelView.prototype.setItem = function (e, t) {
			const result = UTDefaultSetItem.call(this, e, t);
			// Concept player
			if (
				e.concept ||
				e.isLoaned() ||
				!e.isPlayer() ||
				e.isDuplicate() ||
				!e.id
			) {
				return result;
			}
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
			return result;
		};
		const UTDefaultAction = UTDefaultActionPanelView.prototype.render;
		UTDefaultActionPanelView.prototype.render = function (e, t, i, o, n, r, s) {
			const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
			// Concept player
			if (
				e.concept ||
				e.isLoaned() ||
				!e.isPlayer() ||
				e.isDuplicate() ||
				!e.id
			) {
				return result;
			}
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
			return result;
		};
		const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
		UTPlayerItemView.prototype.renderItem = function (item, t) {
			const result = UTPlayerItemView_renderItem.call(this, item, t);
			if (getPrice(item)) {
				this.__root.prepend(
					createElem(
						'div',
						{ className: 'currency-coins item-price' },
						getPrice(item).toLocaleString()
					)
				);
			}
			if (isItemLocked(item)) {
				addClass(this, 'locked');
			} else {
				removeClass(this, 'locked');
			}
			return result;
		};
	}; // CONCATENATED MODULE: ./src/pages/Content/overrides/web-app-fix.js

	const webAppFix = () => {
		// As of 05Dec this function is broken on EA's web app. This is a temporary fix until they fix it on upstream.
		UTSquadChemCalculatorUtils.prototype.getChemProfileForPlayer = function (
			t
		) {
			if (this.chemService.isFeatureEnabled) {
				let e = this.chemService.getRarityProfile(t.rareflag);
				if (e && t.getBaseRarity() === t.rareflag) return e;
				let i = this.chemService.getProfileById(ChemistryProfileId.BASE);
				return (
					t.isLegend()
						? (i =
								e && e.iconOverride
									? e
									: this.chemService.getProfileById(ChemistryProfileId.ICON))
						: t.isLeagueHeroItem() || t.isShapeshifterHeroItem()
						? (i =
								e && e.heroOverride
									? e
									: this.chemService.getProfileById(ChemistryProfileId.HERO))
						: e && e.baseOverride && (i = e),
					i
				);
			}
			return null;
		};
		UTSquadChemCalculatorUtils.prototype.calculate = function (v, t, e) {
			let b = this,
				I = t.slice(0, UTSquadChemCalculatorUtils.FIELD_PLAYERS),
				C = [],
				U = new EAHashTable(),
				A = new EAHashTable(),
				w = new EAHashTable(),
				y = this.chemService.getParameter(ChemistryParamId.CLUB),
				m = this.chemService.getParameter(ChemistryParamId.LEAGUE),
				T = this.chemService.getParameter(ChemistryParamId.NATION),
				g = {
					parameters: [],
					slots: [],
				},
				f = UTSquadChemCalculatorUtils.SLOT_MAX_CHEMISTRY,
				O = [],
				P = [],
				L = [],
				R = [],
				D = [],
				V = [],
				N = [],
				M = [],
				B = [];
			return (
				DebugUtils.Assert(
					11 === I.length,
					'Unexpected number of player items. Found: ' +
						I.length +
						'. Expected: 11.'
				),
				I.concat(e).forEach(function (o, t) {
					let e, i, n, r, a;
					C[t] = b.getChemProfileForPlayer(o);
					let s = C[t];
					if (b.canContribute(o)) {
						let l =
								null !==
									(i =
										null === (e = v.getPosition(t)) || void 0 === e
											? void 0
											: e.typeId) && void 0 !== i
									? i
									: -1,
							c = o.isManager() || o.possiblePositions.includes(l),
							u = b.getContribution(ChemistryParamId.CLUB, o, s),
							p = b.getContribution(ChemistryParamId.LEAGUE, o, s),
							d = b.getContribution(ChemistryParamId.NATION, o, s);
						if (s) {
							let h = o.rareflag,
								_ =
									null === (n = s.getRuleByParamId(ChemistryParamId.CLUB)) ||
									void 0 === n
										? void 0
										: n.calculationType,
								y =
									null === (r = s.getRuleByParamId(ChemistryParamId.LEAGUE)) ||
									void 0 === r
										? void 0
										: r.calculationType,
								m =
									null === (a = s.getRuleByParamId(ChemistryParamId.NATION)) ||
									void 0 === a
										? void 0
										: a.calculationType;
							if (
								_ ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT ||
								y ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT ||
								m ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT
							) {
								let T = I.filter(function (t, e) {
										let i,
											n,
											r =
												null !==
													(n =
														null === (i = v.getPosition(e)) || void 0 === i
															? void 0
															: i.typeId) && void 0 !== n
													? n
													: -1;
										return t.rareflag === h && t.possiblePositions.includes(r);
									}).length,
									g =
										I.filter(function (t) {
											return t.rareflag === h;
										}).length - T;
								if (
									_ ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT
								)
									I.some(function (t, e) {
										let i,
											n,
											r =
												null !==
													(n =
														null === (i = v.getPosition(e)) || void 0 === i
															? void 0
															: i.typeId) && void 0 !== n
													? n
													: -1;
										return (
											b.normalizeClubId(t.teamId) ===
												b.normalizeClubId(o.teamId) &&
											t.possiblePositions.includes(r)
										);
									})
										? (O[h] = T * u)
										: (P[h] = T * u),
										(P[h] = g * u);
								if (
									y ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT
								)
									(E = I.some(function (t, e) {
										let i,
											n,
											r =
												null !==
													(n =
														null === (i = v.getPosition(e)) || void 0 === i
															? void 0
															: i.typeId) && void 0 !== n
													? n
													: -1;
										return (
											t.leagueId === o.leagueId &&
											t.possiblePositions.includes(r)
										);
									}))
										? (L[h] = T * p)
										: (R[h] = T * p),
										(R[h] = g * p);
								if (
									m ===
									ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT
								)
									I.some(function (t, e) {
										let i,
											n,
											r =
												null !==
													(n =
														null === (i = v.getPosition(e)) || void 0 === i
															? void 0
															: i.typeId) && void 0 !== n
													? n
													: -1;
										return (
											t.nationId === o.nationId &&
											t.possiblePositions.includes(r)
										);
									})
										? (D[h] = T * d)
										: (V[h] = T * d),
										(V[h] = g * d);
							}
							b.isRestrictedClub(o.teamId) ||
								(b.addProfileContributions(
									U,
									ChemistryParamId.CLUB,
									b.normalizeClubId(o.teamId),
									u,
									c
								),
								N.includes(b.normalizeClubId(o.teamId)) ||
									N.push(b.normalizeClubId(o.teamId))),
								b.isRestrictedLeague(o.leagueId) ||
									(b.addProfileContributions(
										A,
										ChemistryParamId.LEAGUE,
										o.leagueId,
										p,
										c
									),
									M.includes(o.leagueId) || M.push(o.leagueId)),
								b.addProfileContributions(
									w,
									ChemistryParamId.NATION,
									o.nationId,
									d,
									c
								),
								B.includes(o.nationId) || B.push(o.nationId);
						} else {
							let f = I.filter(function (t, e) {
									let i,
										n,
										r =
											null !==
												(n =
													null === (i = v.getPosition(e)) || void 0 === i
														? void 0
														: i.typeId) && void 0 !== n
												? n
												: -1;
									return t.isLegend() && t.possiblePositions.includes(r);
								}).length,
								S =
									I.filter(function (t) {
										return t.isLegend();
									}).length - f,
								E = I.some(function (t, e) {
									let i,
										n,
										r =
											null !==
												(n =
													null === (i = v.getPosition(e)) || void 0 === i
														? void 0
														: i.typeId) && void 0 !== n
												? n
												: -1;
									return (
										t.leagueId === o.leagueId && t.possiblePositions.includes(r)
									);
								});
							b.isRestrictedClub(o.teamId) ||
								b.addContributions(
									U,
									ChemistryParamId.CLUB,
									b.normalizeClubId(o.teamId),
									u,
									c
								),
								b.isRestrictedLeague(o.leagueId) ||
									b.addLeagueContributions(
										A,
										ChemistryParamId.LEAGUE,
										o.leagueId,
										p,
										c,
										f,
										S,
										E
									),
								b.addContributions(
									w,
									ChemistryParamId.NATION,
									o.nationId,
									d,
									c
								);
						}
					}
				}),
				this.chemService.isFeatureEnabled &&
					(N.forEach(function (t) {
						b.addUniversalContribution(U, t, O, P);
					}),
					M.forEach(function (t) {
						b.addUniversalContribution(A, t, L, R);
					}),
					B.forEach(function (t) {
						b.addUniversalContribution(w, t, D, V);
					})),
				I.forEach(function (t, e) {
					let i,
						n,
						r =
							null !==
								(n =
									null === (i = v.getPosition(e)) || void 0 === i
										? void 0
										: i.typeId) && void 0 !== n
								? n
								: -1,
						o = t.isManager() || t.possiblePositions.includes(r),
						a = b.isMaxChem(t, C[e]),
						s = {
							missed: 0,
							parameters: [],
							points: 0,
						};
					if (b.canContribute(t)) {
						if ((a && o && (s.points = f), y)) {
							let l = b.normalizeClubId(t.teamId),
								c = U.get(l),
								u = {
									id: ChemistryParamId.CLUB,
									points: 0,
								};
							c &&
								0 < c.contributions &&
								(c.contributions > y.requirement &&
									(c.contributions = y.requirement),
								y.thresholds.forEach(function (t) {
									c.contributions >= t.requirement &&
										(o
											? ((s.points += t.points), (u.points += t.points))
											: (s.missed += t.points));
								})),
								s.parameters.push(u);
						}
						if (m) {
							let p = A.get(t.leagueId),
								d = {
									id: ChemistryParamId.LEAGUE,
									points: 0,
								};
							p &&
								0 < p.contributions &&
								(p.contributions > m.requirement &&
									(p.contributions = m.requirement),
								m.thresholds.forEach(function (t) {
									p.contributions >= t.requirement &&
										(o
											? ((s.points += t.points), (d.points += t.points))
											: (s.missed += t.points));
								})),
								s.parameters.push(d);
						}
						if (T) {
							let h = w.get(t.nationId),
								_ = {
									id: ChemistryParamId.NATION,
									points: 0,
								};
							h &&
								0 < h.contributions &&
								(h.contributions > T.requirement &&
									(h.contributions = T.requirement),
								T.thresholds.forEach(function (t) {
									h.contributions >= t.requirement &&
										(o
											? ((s.points += t.points), (_.points += t.points))
											: (s.missed += t.points));
								})),
								s.parameters.push(_);
						}
						s.points > f
							? ((s.points = f), (s.missed = 0))
							: s.points + s.missed > f && (s.missed = f - s.points),
							g.slots.push(s);
					} else g.slots.push(s);
				}),
				(g.parameters = U.values().concat(A.values(), w.values())),
				new UTSquadChemistryVO(g)
			);
		};
	}; // CONCATENATED MODULE: ./src/pages/Content/overrides.js
	let priceCacheMinutes = 60;
	let PRICE_ITEMS_KEY = 'futbinprices';
	let cachedPriceItems;

	let getPrice = function (item) {
		let PriceItems = getPriceItems();

		if (
			PriceItems[item.definitionId] &&
			PriceItems[item.definitionId]?.expiryTimeStamp &&
			new Date(PriceItems[item.definitionId]?.expiryTimeStamp) < Date.now()
		) {
			return null;
		}
		return PriceItems[item.definitionId]?.price;
	};

	let PriceItem = function (item, price) {
		let PriceItems = getPriceItems();
		PriceItems[item.definitionId] = {
			expiryTimeStamp: new Date(Date.now() + priceCacheMinutes * 60 * 1000),
			price: price,
		};
		savePriceItems();
	};

	const dateTimeReviver = function (key, value) {
		var a;
		if (typeof value === 'string') {
			a = /\/Date\((\d*)\)\//.exec(value);
			if (a) {
				return new Date(+a[1]);
			}
		}
		return value;
	};
	let getPriceItems = function () {
		if (cachedPriceItems) {
			return cachedPriceItems;
		}
		cachedPriceItems = {};
		let PriceItems = localStorage.getItem(PRICE_ITEMS_KEY);
		if (PriceItems) {
			cachedPriceItems = JSON.parse(PriceItems, dateTimeReviver);
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
					hideLoader();
				});
		});
	}
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

			const priceResponse = JSON.parse(futBinResponse);

			for (const id of [primaryId, ...playersIdArray]) {
				const prices = priceResponse[id].prices[getUserPlatform()];
				const lcPrice = prices.LCPrice;
				if (!lcPrice) {
					continue;
				}
				const cardPrice = parseInt(lcPrice.replace(/[,.]/g, ''));
				PriceItem(players.filter((f) => f.definitionId == id)[0], cardPrice);
			}
		}
	};

	const getUserPlatform = () => {
		if (services.User.getUser().getSelectedPersona().isPC) {
			return 'pc';
		}
		return 'ps';
	};

	const init = () => {
		sbcViewOverride();
		futHomeOverride();
		sbcButtonOverride();
		playerItemOverride();
		webAppFix();
	};
	init();
})();

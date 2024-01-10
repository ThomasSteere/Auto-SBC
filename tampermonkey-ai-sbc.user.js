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

			await fetchLowestPriceByRating();
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
							price:
								getPrice(item) *
									(duplicateIds.includes(item.id) ? 0.1 : 1) *
									(item.untradeable ? 0.8 : 1) -
								(100 - item.rating) * (isItemFixed(item) ? 0 : 1),
						};
					});

				const input = JSON.stringify({
					clubPlayers: backendPlayersInput,
					sbcData: sbcData,
					duplicates: duplicateIds,
					// TODO: make this a togle button
					//useConceptPlayers: true,
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
				const { _squad, _challenge } = getControllerInstance();
				_squad.removeAllItems();

				let _solutionSquad = [...Array(11)];
				sbcData.brickIndices.forEach(function (item, index) {
					_solutionSquad[item] = new UTItemEntity();
				});
				console.log(_solutionSquad);
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

	let PriceItem = function (item, price) {
		let PriceItems = getPriceItems();
		PriceItems[item.definitionId] = {
			expiryTimeStamp: new Date(Date.now() + priceCacheMinutes * 60 * 1000),
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
			try {
				const priceResponse = JSON.parse(futBinResponse);
			} catch (error) {
				console.log(futBinResponse);
				console.error(error);
				await wait()
				continue;
			}
			for (const id of [primaryId, ...playersIdArray]) {
				const prices = priceResponse[id].prices[getUserPlatform()];

				const lcPrice = prices.LCPrice;
				if (!lcPrice) {
					continue;
				}
				let cardPrice = parseInt(lcPrice.replace(/[,.]/g, ''));
				if (cardPrice == 0) {
					let player = players.filter((f) => f.definitionId == id)[0];

					if (!prices.updated) {
						await fetchPlayerPrices(
							players.filter((f) => f.definitionId == id)
						);
						continue;
					}
					cardPrice = player._itemPriceLimits.maximum;
					if (prices.updated == 'Never') {
						//never indicates its not on the market so give it the lowest price of the rating with a premium
						let newPrice = getPrice({ definitionId: player._rating + '_CBR' });
						cardPrice = Math.min(
							Math.max(newPrice * 1.5, player._itemPriceLimits.minimum),
							player._itemPriceLimits.maximum
						);
					}
				}
				PriceItem(players.filter((f) => f.definitionId == id)[0], cardPrice);
			}
			await wait();
		}
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

	const init = () => {
		sbcViewOverride();
		futHomeOverride();
		sbcButtonOverride();
		playerItemOverride();
		playerSlotOverride();
	};
	init();
})();

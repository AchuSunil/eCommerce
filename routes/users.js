// const { response } = require("express");
const express = require("express");
const router = express.Router();
const userHelper = require("../helpers/user-helpers");

const client = require("twilio")(process.env.accountSID, process.env.authToken);
const { verifyLoginUser } = require("../config/middlewares");
const productHelpers = require("../helpers/product-helpers");
const paypal = require("paypal-rest-sdk");
const { response } = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

paypal.configure({
    mode: "sandbox", //sandbox or live
    client_id: process.env.client_id,
    client_secret: process.env.client_secret,
});

/* GET home page. */
router.get("/", function (req, res) {
    userHelper.getHomePage().then(async (response) => {
        let standardtvs = response.standardtvs;
        let newLaunch = response.newLaunch;
        let smartTvs = response.smartTvs;
        let banner1 = response.banner1;
        let banner2 = response.banner2;

        if (req.session.user) {
            let cartCount = await userHelper.getCartCount(req.session.user._id);
            let wishlistCount = await userHelper.getWishlistCount(req.session.user._id);
            req.session.wishlistCount = wishlistCount;
            req.session.cartCount = cartCount;
            let userLog = req.session.user;

            res.render("user/homepage/user-homepage", {
                user: true,
                userLog,
                standardtvs,
                newLaunch,
                smartTvs,
                cartCount,
                banner1,
                banner2,
                wishlistCount,
            });
        } else {
            res.render("user/homepage/user-homepage", { user: true, standardtvs, newLaunch, smartTvs, banner1, banner2 });
        }
    });
});

/*login Router*/
router.get("/login", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        if (req.session.logErr) {
            req.session.logErr = false;
            let errMsg = "*Enter a valid Username or Password";
            res.render("user/signup&login/login", { user: true, errMsg });
        } else if (req.session.adminBlock) {
            req.session.adminBlock = false;
            let errMsg = "*Admin Blocked You";
            res.render("user/signup&login/login", { user: true, errMsg });
        } else {
            res.render("user/signup&login/login", { user: true });
        }
    }
});

/*login post Router*/
router.post("/login-submit", function (req, res) {
    userHelper
        .doLogin(req.body)
        .then((response) => {
            if (response.loginStatus) {
                req.session.user = response.user;

                res.redirect("/");
            } else {
                req.session.logErr = true;
                res.redirect("/login");
            }
        })
        .catch((response) => {
            req.session.adminBlock = true;
            res.redirect("/login");
        });
});

//user logout Router
router.get("/logout", (req, res) => {
    req.session.user = null;
    res.redirect("/");
});

/*signup register Router*/
router.get("/register", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        if (req.session.regErr) {
            req.session.regErr = false;
            let errMsg = "*E-mail Address or Phone Number Already Exists";
            res.render("user/signup&login/register", { user: true, errMsg });
        } else {
            res.render("user/signup&login/register", { user: true });
        }
    }
});

//signup post Router

router.post("/register-submit", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        req.session.userDetails = req.body; //this have all the details of the user from register form

        userHelper.doSignup(req.body).then((status) => {
            if (status.status == true) {
                req.session.regErr = true;
                res.redirect("/register");
            } else {
                userHelper.doRegister(req.session.userDetails).then((response) => {
                    res.redirect("/login");
                });
            }
        });
    }
});

//OTP send post Router
router.post("/send-OTP", (req, res) => {
    userHelper.sendOTP(req.body.num).then((response) => {
        if (response.OTP == false) {
            res.json({ status: false });
        } else {
            res.json({ status: true });
        }
    });
});

router.post("/verifySignupOTP", (req, res) => {
    let otp = req.body.OTP;
    let mob = req.body.mobile;

    // checking otp which is send to the entered mobile number
    client.verify
        .services(process.env.serviceSID)
        .verificationChecks.create({
            to: `+91${mob}`,
            code: otp,
        })
        .then(async (data) => {
            if (data.status == "approved") {
                await userHelper.findUser(mob).then(async (userDetails) => {
                    await userHelper
                        .doLoginOTP(userDetails)
                        .then((response) => {
                            if (response.loginStatus) {
                                req.session.user = response.user;

                                res.json({ status: true });
                            } else {
                                res.json({ status: false });
                            }
                        })
                        .catch((response) => {
                            res.json({ response: true });
                        });
                });
            } else {
                res.json({ status: false });
            }
        });
});

// Product grids for new launches Router
router.get("/product-grids", async (req, res) => {
    await userHelper.getNewLaunches().then(async (newLaunches) => {
        if (req.session.user) {
            let userLog = req.session.user;
            let cartCount = req.session.cartCount;
            let wishlistCount = await userHelper.getWishlistCount(req.session.user._id);
            res.render("user/products/product-grids", { user: true, userLog, cartCount, newLaunches, wishlistCount });
        } else {
            res.render("user/products/product-grids", { user: true, newLaunches });
        }
    });
});

// Product details Router
router.get("/product-details/:id", (req, res) => {
    productHelpers.getProductDetails(req.params.id).then(async (productDetails) => {
        if (req.session.user) {
            let userLog = req.session.user;
            let cartCount = req.session.cartCount;
            let wishlistCount = await userHelper.getWishlistCount(req.session.user._id);
            res.render("user/products/product-details", { user: true, userLog, cartCount, productDetails, wishlistCount });
        } else {
            res.render("user/products/product-details", { user: true, productDetails });
        }
    });
});

//////cart error router
router.get("/cart-err", (req, res) => {
    if (req.session.user) {
        res.redirect("/cart-details");
    } else {
        res.render("user/products/cart-err", { user: true });
    }
});

// view cart details Router
router.get("/cart-details", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = await userHelper.getCartCount(req.session.user._id);
        req.session.cartCount = cartCount;
        let cartProducts = await userHelper.getCartProducts(req.session.user._id);
        let wishlistCount = req.session.wishlistCount;

        let totalAmt = 0;
        if (cartProducts.length > 0) {
            totalAmt = await userHelper.getTotalAmount(req.session.user._id);
            res.render("user/products/cart-details", {
                user: true,
                cartProducts,
                totalAmt,
                userLog,
                cartCount,
                wishlistCount,
            });
        } else {
            res.render("user/products/add-tocart-err", { user: true, userLog, cartCount, wishlistCount });
        }
    } else {
        res.redirect("/cart-err");
    }
});

///mywishlist Router
router.post("/add-toWishlist", (req, res) => {
    if (req.session.user) {
        userHelper.addToWishlist(req.body.proId, req.session.user._id).then((response) => {
            userHelper.getWishlistCount(req.session.user._id).then((wishlistCount) => {
                req.session.wishlistCount = wishlistCount;
                if (response.productAdded) {
                    res.json({ status: true, wishlistCount });
                } else {
                    res.json({ status: false, wishlistCount });
                }
            });
        });
    } else {
        res.redirect("/login");
    }
});

//view wishlist Router
router.get("/view-wishlist", async (req, res) => {
    if (req.session.user) {
        await userHelper.getUserWishlist(req.session.user._id).then((response) => {
            if (response.noWishlist) {
                res.render("user/account/add-toWishlist-err", { user: true });
            } else {
                let userWishlist = response;
                let wishlistCount = req.session.wishlistCount;
                let cartCount = req.session.cartCount;

                res.render("user/account/mywhislist", { user: true, userWishlist, wishlistCount, cartCount });
            }
        });
    } else {
        res.redirect("/login");
    }
});

//remove item from wishlist
router.post("/removeItem-wishlist", (req, res) => {
    if (req.session.user) {
        let wishlistId = req.body.wishlistId;
        let proId = req.body.proId;

        userHelper.removeItemWishlist(wishlistId, proId).then(() => {
            userHelper.getWishlistCount(req.session.user._id).then((wishlistCount) => {
                req.session.wishlistCount = wishlistCount;
                res.json({ removed: true });
            });
        });
    }
});

// Product Add-toCart Router
router.get("/add-tocart/:id", (req, res) => {
    if (req.session.user) {
        userHelper.addToCart(req.params.id, req.session.user._id).then((response) => {
            res.redirect("/");
        });
    } else {
        res.redirect("/cart-err");
    }
});

//Add to cart from product details page
router.get("/add-tocart-productDetailsPage/:id", (req, res) => {
    if (req.session.user) {
        userHelper.addToCart(req.params.id, req.session.user._id).then((response) => {
            res.redirect("/cart-details");
        });
    } else {
        res.redirect("/cart-err");
    }
});

// Change product Quantity post method using ajax calling from cart-details.hbs Router
router.post("/change-product-quantity", (req, res) => {
    userHelper.changeProductQuantity(req.body).then(async (response) => {
        response.totalAmt = await userHelper.getTotalAmount(req.session.user._id);
        res.json(response);
    });
});

//remove product from cart/ post method using ajax calling from cart-details.hbs Router
router.post("/removeProduct", (req, res) => {
    userHelper.removeProduct(req.body).then((response) => {
        res.json(response);
    });
});

//total amount at checkout and cart router
router.get("/getCheckout", async (req, res) => {
    if (req.session.user) {
        let applied = false;
        let userLog = req.session.user;
        let userId = req.session.user._id;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;

        if (cartCount <= 0) {
            res.render("user/products/add-tocart-err", { user: true, userLog, cartCount, wishlistCount });
        } else {
            let totalAmt = {};
            totalAmt.price = await userHelper.getTotalAmount(req.session.user._id);

            let viewAddress = await userHelper.getAllAddress(req.session.user._id);

            let cartProducts = await userHelper.getCartProducts(req.session.user._id);
            let coupon = await userHelper.getAllCoupons();
            let userCart = await userHelper.getCart(req.session.user._id);

            if (userCart.coupon) {
                let val = parseInt(totalAmt.price);

                totalAmt.final = parseInt(val - (userCart.discount * val) / 100);
                totalAmt.discount = parseInt((userCart.discount * val) / 100);

                await userHelper.updateCart(req.session.user._id, totalAmt.final, totalAmt.discount);
            }
            let amount = await userHelper.getCart(req.session.user._id);
            let applied = amount.applied;

            totalAmt.tot = amount.finalPrice ? amount.finalPrice : totalAmt.price;
            totalAmt.dis = amount.discount ? amount.discount : 0;

            if (viewAddress[0] != undefined) {
                res.render("user/products/cart-checkout", {
                    user: true,
                    totalAmt,
                    viewAddress,
                    cartProducts,
                    userId,
                    userLog,
                    cartCount,
                    coupon,
                    applied,
                    wishlistCount,
                });
            } else {
                res.render("user/products/cart-checkout", {
                    user: true,
                    totalAmt,
                    cartProducts,
                    userLog,
                    cartCount,
                    applied,
                    wishlistCount,
                });
            }
        }
    } else {
        res.redirect("/");
    }
});

//Get Add Address page Router
router.get("/adduseraddress", (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let userId = req.session.user._id;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        res.render("user/account/addUserAddress", { user: true, userId, userLog, cartCount, wishlistCount });
    } else {
        res.redirect("/");
    }
});

//post Add address router
router.post("/adduseraddress", (req, res) => {
    userHelper.addUserAddress(req.body).then((response) => {
        res.redirect("/userAddress");
    });
});

//Edit Address Router
router.get("/edituseraddress/:id", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        let addressDetails = await userHelper.editUserAddress(req.params.id);
        res.render("user/account/editUserAddress", { user: true, addressDetails, userLog, cartCount, wishlistCount });
    } else {
        res.redirect("/");
    }
});

//post Edit address router
router.post("/edituseraddress", (req, res) => {
    if (req.session.user) {
        userHelper.updateUserAddress(req.body).then(() => {
            res.redirect("/userAddress");
        });
    } else {
        res.redirect("/");
    }
});

//Router for Place Order by ajax at checkout hbs(Online payments used paypal and razorpay)
router.post("/place-order", async (req, res) => {
    if (req.session.user) {
        let products = await userHelper.getCartProductList(req.session.user._id);
        let totalPrice = await userHelper.getTotalAmount(req.session.user._id);
        let userCart = await userHelper.getCart(req.session.user._id);
        let total = userCart.finalPrice ? userCart.finalPrice : totalPrice;
        if (userCart.coupon) req.body.coupon = userCart.coupon;
        userHelper.placeOrder(req.body, products, total).then((orderId) => {
            req.session.orderId = orderId;
            if (req.body.Payment == "COD") {
                res.json({ COD_Success: true });
            } else if (req.body.Payment == "Razorpay") {
                userHelper.generateRazorpay(orderId, total).then((order) => {
                    res.json({ razorpay: true, order });
                });
            } else if (req.body.Payment == "Paypal") {
                req.session.orderId = orderId;
                let paypalPayAmt = parseFloat(total / 75).toFixed(2);
                req.session.paypalPayAmt = paypalPayAmt;

                const create_payment_json = {
                    intent: "sale",
                    payer: {
                        payment_method: "paypal",
                    },
                    redirect_urls: {
                        return_url: "http://localhost:3000/paypalSuccess",
                        cancel_url: "http://localhost:3000/cancel",
                    },
                    transactions: [
                        {
                            item_list: {
                                items: [
                                    {
                                        name: orderId,
                                        sku: "001",
                                        price: paypalPayAmt,
                                        currency: "USD",
                                        quantity: 1,
                                    },
                                ],
                            },
                            amount: {
                                currency: "USD",
                                total: paypalPayAmt,
                            },
                            description: "order for Electro_Gen",
                        },
                    ],
                };

                paypal.payment.create(create_payment_json, function (error, payment) {
                    if (error) {
                        throw error;
                    } else {
                        for (let i = 0; i < payment.links.length; i++) {
                            if (payment.links[i].rel === "approval_url") {
                                res.json({ paypal: true, val: payment.links[i].href });
                            }
                        }
                    }
                });
            }
        });
    } else {
        res.redirect("/");
    }
});

//online razorpay payment verifying
router.post("/verify-payment", (req, res) => {
    if (req.session.user) {
        userHelper
            .verifyPayment(req.body)
            .then(() => {
                userHelper.changePaymentStatus(req.body["order[receipt]"], req.session.user._id).then(() => {
                    res.json({ razorpayStatus: true });
                });
            })
            .catch((err) => {
                res.json({ razorpayStatus: false });
            });
    } else {
        res.redirect("/login");
    }
});

//paypal success router
router.get("/paypalSuccess", (req, res) => {
    if (req.session.user) {
        let orderId = req.session.orderId;
        let paypalPayAmt = req.session.paypalPayAmt;

        const payerId = req.query.PayerID;
        const paymentId = req.query.paymentId;

        const execute_payment_json = {
            payer_id: payerId,
            transactions: [
                {
                    amount: {
                        currency: "USD",
                        total: paypalPayAmt,
                    },
                },
            ],
        };

        paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
            if (error) {
                throw error;
            } else {
                userHelper.changePaymentStatus(orderId, req.session.user._id).then(() => {
                    res.redirect("/order-success");
                });
            }
        });
    } else {
        res.redirect("/");
    }
});

///User Profile view Router
router.get("/userProfile", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        await userHelper.getUserDetails(req.session.user._id).then((userDetails) => {
            fs.readFile("./public/profilePicture/" + req.session.user._id + ".jpg", (err, data) => {
                if (err) {
                    res.render("user/account/userProfile", { user: true, userDetails, userLog, cartCount, wishlistCount });
                } else if (data) {
                    res.render("user/account/userProfile", {
                        user: true,
                        userDetails,
                        userLog,
                        cartCount,
                        wishlistCount,
                        propic: true,
                    });
                }
            });
        });
    } else {
        res.redirect("/login");
    }
});

//router for upload user profile picture
router.post("/uploadProfilePic", (req, res) => {
    if (req.session.user) {
        if (req.files && req.files.proPic) {
            let id = req.session.user._id;
            let image = req.files.proPic;
            image.mv("./public/profilePicture/" + id + ".jpg");

            res.redirect("/userProfile");
        }
    } else {
        res.redirect("/login");
    }
});

///User Profile Edit Router
router.get("/editUserProfile", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        await userHelper.getUserDetails(req.session.user._id).then((userDetails) => {
            fs.readFile("./public/profilePicture/" + req.session.user._id + ".jpg", (err, data) => {
                if (err) {
                    res.render("user/account/userProfile", { user: true, userDetails, userLog, cartCount, wishlistCount });
                } else if (data) {
                    res.render("user/account/userProfile", {
                        user: true,
                        userDetails,
                        userLog,
                        cartCount,
                        wishlistCount,
                        propic: true,
                    });
                }
            });
        });
    } else {
        res.redirect("/login");
    }
});

///User Profile edit post Router
router.post("/editUserProfile/:id", (req, res) => {
    if (req.session.user) {
        userHelper.updateUserProfile(req.params.id, req.body).then(() => {
            res.redirect("/userProfile");
        });
    }
});

//change password
router.get("/changePassword", (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        res.render("user/account/change-password", { user: true, cartCount, userLog, wishlistCount });
    } else {
        res.redirect("/");
    }
});
//change password post router call from ajax change-password.hbs
router.post("/changePassword", (req, res) => {
    if (req.session.user) {
        if (req.body.newPassword) {
            userHelper.changePassword(req.body, req.session.user._id).then((response) => {
                if (response.errOccur) {
                    res.json({ errOccured: true });
                } else {
                    res.json({ status: true });
                }
            });
        } else {
            res.json({ status: false });
        }
    } else {
        res.redirect("/");
    }
});

///User Profile Address Router
router.get("/userAddress", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let id = req.session.user._id;
        let wishlistCount = req.session.wishlistCount;
        let viewAddress = await userHelper.getAllAddress(req.session.user._id);
        fs.readFile("./public/profilePicture/" + req.session.user._id + ".jpg", (err, data) => {
            if (err) {
                res.render("user/account/userAddress", { user: true, viewAddress, userLog, cartCount, wishlistCount });
            } else if (data) {
                res.render("user/account/userAddress", {
                    user: true,
                    viewAddress,
                    userLog,
                    cartCount,
                    wishlistCount,
                    propic: true,
                    id,
                });
            }
        });
    } else {
        res.redirect("/login");
    }
});

///User Profile Address Delete Router
router.get("/deleteUserAddress/:id", (req, res) => {
    if (req.session.user) {
        userHelper.deleteUserAddress(req.params.id).then(() => {
            res.redirect("/userAddress");
        });
    }
});

///User Profile Orders-success Router
router.get("/order-success", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = await userHelper.getCartCount(req.session.user._id);
        req.session.cartCount = cartCount;
        let wishlistCount = req.session.wishlistCount;
        let orderDetail = await userHelper.orderDetails(req.session.orderId, req.session.user._id);
        if (orderDetail.coupon) {
            await userHelper.useCoupon(req.session.user._id, orderDetail.coupon);
        }
        res.render("user/products/order-success", { user: true, userLog, cartCount, wishlistCount });
    } else {
        res.redirect("/");
    }
});

///User Profile User Orders Router
router.get("/userOrder", async (req, res) => {
    if (req.session.user) {
        let userLog = req.session.user;
        let id = req.session.user._id;
        let cartCount = req.session.cartCount;
        let wishlistCount = req.session.wishlistCount;
        await userHelper.getUserOrderProducts(req.session.user._id).then((allOrders) => {
            if (allOrders.length === 0) {
                res.render("user/account/userOrder-err", { user: true, userLog, wishlistCount });
            } else {
                fs.readFile("./public/profilePicture/" + req.session.user._id + ".jpg", (err, data) => {
                    if (err) {
                        res.render("user/account/userOrders", { user: true, allOrders, userLog, cartCount, wishlistCount });
                    } else if (data) {
                        res.render("user/account/userOrders", {
                            user: true,
                            allOrders,
                            userLog,
                            cartCount,
                            wishlistCount,
                            propic: true,
                            id,
                        });
                    }
                });
            }
        });
    } else {
        res.redirect("/login");
    }
});

//user product cancel router
router.post("/userProductCancel", async (req, res) => {
    if (req.session.user) {
        await userHelper.userOrderStatus(req.body.orderId, req.body.itemId).then(() => {
            res.json({ status: true });
        });
    } else {
        res.redirect("/login");
    }
});

//Router for home-page view all smart-android tvs
router.get("/view-smartAndroidTvs", async (req, res) => {
    let smartAndroidTvs = await userHelper.viewSmartAndroidTvs();

    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = await userHelper.getWishlistCount(req.session.user._id);
        req.session.wishlistCount = wishlistCount;
        res.render("user/products/product-grids", { user: true, userLog, cartCount, smartAndroidTvs, wishlistCount });
    } else {
        res.render("user/products/product-grids", { user: true, smartAndroidTvs });
    }
});

//Router for home-page view all standard tvs
router.get("/view-standardTvs", async (req, res) => {
    let standardTvs = await userHelper.viewStandardTvs();

    if (req.session.user) {
        let userLog = req.session.user;
        let cartCount = req.session.cartCount;
        let wishlistCount = await userHelper.getWishlistCount(req.session.user._id);
        res.render("user/products/product-grids", { user: true, userLog, cartCount, standardTvs, wishlistCount });
    } else {
        res.render("user/products/product-grids", { user: true, standardTvs });
    }
});

//router for search coupon that checking if user already used or not
router.post("/coupon-search", (req, res) => {
    if (req.session.user) {
        userHelper.checkCoupon(req.body, req.session.user._id).then((response) => {
            res.json(response);
        });
    }
});

////Router delete coupon
router.get("/delete-coupon", (req, res) => {
    if (req.session.user) {
        userHelper.deleteCoupon(req.session.user._id).then(() => {
            res.json({ status: true });
        });
    } else {
        res.redirect("/login");
    }
});

//router for search products
router.get("/products/search", async (req, res) => {
    try {
        let smartAndroidTvs;
        if (req.session.resultTrue) {
            smartAndroidTvs = req.session.result;
            req.session.resultTrue = false;
        } else {
            smartAndroidTvs = await userHelper.searchProducts(req.query.search);
        }

        req.session.smartAndroidTvs = smartAndroidTvs;
        res.render("user/products/product-grids", { user: true, smartAndroidTvs });
    } catch (err) {
        res.render("user/products/product-grids", { user: true, smartAndroidTvs: [] });
    }
});

// search sort low to high product
router.get("/low-to-high", async (req, res) => {
    try {
        function compareName(a, b) {
            // converting to uppercase to have case-insensitive comparison
            const name1 = a.Price;
            const name2 = b.Price;

            let comparison = 0;

            if (name1 > name2) {
                comparison = 1;
            } else if (name1 < name2) {
                comparison = -1;
            }
            return comparison;
        }

        let result = req.session.smartAndroidTvs.sort(compareName);

        req.session.result = result;
        req.session.resultTrue = true;
        req.session.smartAndroidTvs = null;
        res.redirect("/products/search");
    } catch (err) {
        console.log(err);
    }
});
// search sort  high to low  product
router.get("/high-to-low", async (req, res) => {
    try {
        // program to sort array by property name

        function compareName(a, b) {
            // converting to uppercase to have case-insensitive comparison
            const name1 = a.Price;
            const name2 = b.Price;

            let comparison = 0;

            if (name1 < name2) {
                comparison = 1;
            } else if (name1 > name2) {
                comparison = -1;
            }
            return comparison;
        }

        let result = req.session.smartAndroidTvs.sort(compareName);

        req.session.result = result;
        req.session.resultTrue = true;
        req.session.smartAndroidTvs = null;
        res.redirect("/products/search");
    } catch (err) {
        console.log(err);
    }
});

// search sort  A to Z  product
router.get("/A-to-Z", async (req, res) => {
    try {
        // program to sort array by property name

        function compareName(a, b) {
            // converting to uppercase to have case-insensitive comparison
            const name1 = a.product_name;
            const name2 = b.product_name;

            let comparison = 0;

            if (name1 > name2) {
                comparison = 1;
            } else if (name1 < name2) {
                comparison = -1;
            }
            return comparison;
        }

        let result = req.session.smartAndroidTvs.sort(compareName);

        req.session.result = result;
        req.session.resultTrue = true;
        req.session.smartAndroidTvs = null;
        res.redirect("/products/search");
    } catch (err) {
        console.log(err);
    }
});
// search sort  Z to A  product
router.get("/Z-to-A", async (req, res) => {
    try {
        // program to sort array by property name

        function compareName(a, b) {
            // converting to uppercase to have case-insensitive comparison
            const name1 = a.product_name;
            const name2 = b.product_name;

            let comparison = 0;

            if (name1 < name2) {
                comparison = 1;
            } else if (name1 > name2) {
                comparison = -1;
            }
            return comparison;
        }

        let result = req.session.smartAndroidTvs.sort(compareName);

        req.session.result = result;
        req.session.resultTrue = true;
        req.session.smartAndroidTvs = null;
        res.redirect("/products/search");
    } catch (err) {
        console.log(err);
    }
});

module.exports = router;

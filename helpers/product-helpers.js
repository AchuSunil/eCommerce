var db = require("../config/connection");
var collection = require("../config/collections");
const collections = require("../config/collections");
var objectId = require("mongodb").ObjectId;

module.exports = {
    addProduct: (product) => {
        console.log(product);
        product.Price = parseInt(product.Price);
        product.Quantity = parseInt(product.Quantity);
        product.offer = false;
        product.productOffer = false;
        product.addDate = new Date().toString().split("G")[0];
        return new Promise(async (resolve, reject) => {
            await db
                .get()
                .collection(collection.products)
                .insertOne(product)
                .then((data) => {
                    console.log(data);
                    let id = data.insertedId;
                    resolve(id);
                });
        });
    },

    getAllProducts: () => {
        return new Promise(async (resolve, reject) => {
            let products = await db.get().collection(collections.products).find().toArray();
            resolve(products);
        });
    },

    deleteProduct: (proId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.products)
                .deleteOne({ _id: objectId(proId) })
                .then((response) => {
                    resolve(response);
                });
        });
    },

    getProductDetails: (proId) => {
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.products)
                .findOne({ _id: objectId(proId) })
                .then((product) => {
                    resolve(product);
                });
        });
    },

    updateProduct: (proId, productDetails) => {
        let Price = parseInt(productDetails.Price);
        return new Promise((resolve, reject) => {
            db.get()
                .collection(collections.products)
                .updateOne(
                    { _id: objectId(proId) },
                    {
                        $set: {
                            product_name: productDetails.product_name,
                            Category: productDetails.Category,
                            Price: Price,
                            Description: productDetails.Description,
                            Quantity: productDetails.Quantity,
                            modelname: productDetails.modelname,
                            Inch: productDetails.Inch,
                            Resolution: productDetails.Resolution,
                            Brand: productDetails.Brand,
                            OS: productDetails.OS,
                            Screen_type: productDetails.Screen_type,
                            Connectivity: productDetails.Connectivity,
                            HDMI_port: productDetails.HDMI_port,
                            USB_port: productDetails.USB_port,
                        },
                    }
                )
                .then(() => {
                    resolve();
                });
        });
    },
};

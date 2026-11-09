import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  ApiError,
  clearOwnerToken,
  createDish,
  deleteDish,
  fetchAdminDishes,
  fetchCategories,
  updateDish,
  uploadDishImage,
} from '../adminApi';
import type {AdminCategory, AdminDish} from '../adminApi';
import {absoluteImage} from '../api';
import {useNav} from '../nav';
import {colors} from '../theme';

type Props = {
  categoryId: number;
  dishId?: number;
};

export function DishEditScreen({categoryId, dishId}: Props): React.JSX.Element {
  const nav = useNav();
  const isEdit = dishId !== undefined;

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [targetCategory, setTargetCategory] = useState(categoryId);
  const [available, setAvailable] = useState(true);
  const [soldOut, setSoldOut] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const handleAuthError = useCallback(
    async (err: any) => {
      if (err instanceof ApiError && err.status === 401) {
        await clearOwnerToken();
        nav.reset({name: 'ownerLogin'});
        return true;
      }
      return false;
    },
    [nav],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchCategories();
        if (alive) {
          setCategories(list);
        }
        if (isEdit) {
          const dishes = await fetchAdminDishes(categoryId);
          const dish: AdminDish | undefined = dishes.find(d => d.id === dishId);
          if (dish && alive) {
            setName(dish.name);
            setPriceText(String(dish.priceCents / 100));
            setDescription(dish.description);
            setImage(dish.image);
            setTargetCategory(dish.categoryId);
            setAvailable(dish.available);
            setSoldOut(dish.soldOut);
          }
        }
      } catch (err: any) {
        if (!(await handleAuthError(err))) {
          setError(String(err?.message ?? err));
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, dishId, isEdit]);

  const priceCents = useMemo(() => {
    const value = Number(priceText.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.round(value * 100);
  }, [priceText]);

  const pickImage = useCallback(async () => {
    try {
      // 手机上先压一遍再传：原图动辄 1-2MB，隧道/代理下要传几十秒。
      // 800px + 0.6 质量通常 60-120KB，菜单加载也快得多。
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.6,
      });
      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        throw new Error(result.errorMessage || result.errorCode);
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      setError('');
      const url = await uploadDishImage(asset.uri, asset.type, ratio =>
        setUploadProgress(Math.round(ratio * 100)),
      );
      setImage(url);
    } catch (err: any) {
      if (!(await handleAuthError(err))) {
        setError(`图片上传失败：${String(err?.message ?? err)}`);
      }
    } finally {
      setUploading(false);
    }
  }, [handleAuthError]);

  const save = useCallback(async () => {
    if (!name.trim()) {
      setError('菜名不能为空');
      return;
    }
    if (priceCents === null) {
      setError('价格填得不对');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit && dishId !== undefined) {
        await updateDish(dishId, {
          categoryId: targetCategory,
          name: name.trim(),
          priceCents,
          description,
          image,
          available,
          soldOut,
        });
      } else {
        await createDish({
          categoryId: targetCategory,
          name: name.trim(),
          priceCents,
          description,
          image,
        });
      }
      nav.back();
    } catch (err: any) {
      if (!(await handleAuthError(err))) {
        setError(String(err?.message ?? err));
      }
    } finally {
      setSaving(false);
    }
  }, [
    name,
    priceCents,
    isEdit,
    dishId,
    targetCategory,
    description,
    image,
    available,
    soldOut,
    nav,
    handleAuthError,
  ]);

  const remove = useCallback(() => {
    if (dishId === undefined) {
      return;
    }
    Alert.alert('删除菜品', `确定删掉「${name}」？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDish(dishId);
            nav.back();
          } catch (err: any) {
            Alert.alert('删不掉', String(err?.message ?? err));
          }
        },
      },
    ]);
  }, [dishId, name, nav]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const previewUri = absoluteImage(image);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={nav.back} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? '编辑菜品' : '新增菜品'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickImage} style={styles.imageBox}>
          {previewUri ? (
            <Image source={{uri: previewUri}} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageEmpty]}>
              <Text style={styles.imageHint}>＋</Text>
            </View>
          )}
          <Text style={styles.imageAction}>
            {uploading
              ? `上传中 ${uploadProgress}%`
              : previewUri
              ? '点击换一张'
              : '从相册选图片'}
          </Text>
          {uploading ? (
            <View style={styles.imageMask}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>

        <Text style={styles.label}>菜名</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：宫保鸡丁"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>价格（元）</Text>
        <TextInput
          style={styles.input}
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          placeholder="38"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>描述（可选）</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="一句好吃的介绍"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>所属分区</Text>
        <View style={styles.chips}>
          {categories.map(category => {
            const active = category.id === targetCategory;
            return (
              <Pressable
                key={category.id}
                onPress={() => setTargetCategory(category.id)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isEdit ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>上架（顾客能看到）</Text>
            <Switch value={available} onValueChange={setAvailable} />
          </View>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>售罄（显示但点不了）</Text>
          <Switch value={soldOut} onValueChange={setSoldOut} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={save}
          disabled={saving || uploading}
          style={({pressed}) => [
            styles.saveBtn,
            (saving || uploading) && styles.saveBtnBusy,
            pressed && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>保存</Text>
          )}
        </Pressable>

        {isEdit ? (
          <Pressable onPress={remove} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>删除这道菜</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  backBtn: {width: 32},
  back: {fontSize: 26, color: colors.text, lineHeight: 28},
  title: {fontSize: 17, fontWeight: '700', color: colors.text},
  content: {padding: 16, paddingBottom: 48},
  imageBox: {alignItems: 'center', marginBottom: 8},
  image: {width: 120, height: 120, borderRadius: 12, backgroundColor: colors.sidebar},
  imageEmpty: {alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed'},
  imageHint: {fontSize: 30, color: colors.textFaint},
  imageAction: {marginTop: 8, fontSize: 12, color: colors.primary},
  imageMask: {
    position: 'absolute',
    top: 0,
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {marginTop: 18, fontSize: 13, fontWeight: '600', color: colors.text},
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  multiline: {minHeight: 70, textAlignVertical: 'top'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 10},
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {backgroundColor: colors.primarySoft, borderColor: colors.primary},
  chipText: {fontSize: 13, color: colors.textSub},
  chipTextActive: {color: colors.primary, fontWeight: '600'},
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchLabel: {fontSize: 14, color: colors.text},
  error: {marginTop: 14, fontSize: 12, color: colors.danger},
  saveBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnBusy: {opacity: 0.7},
  pressed: {opacity: 0.85},
  saveBtnText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  deleteBtn: {marginTop: 16, alignItems: 'center', paddingVertical: 10},
  deleteText: {fontSize: 13, color: colors.danger},
});
